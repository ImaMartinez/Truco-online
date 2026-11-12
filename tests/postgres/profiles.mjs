import {isolated} from './isolated.mjs';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const migration='supabase/migrations/20261111151817_arena_profiles_web.sql';
const env=await isolated();const {admin:c,db,connect}=env;
async function web(client,uid,op,data={}){
 await client.query('BEGIN');try{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid??'']);const value=(await client.query('SELECT public.ta_web($1,$2::jsonb) value',[op,JSON.stringify(data)])).rows[0].value;await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}
}
try{
 await c.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
 await c.query('BEGIN');await c.query(await readFile(migration,'utf8'));await c.query('COMMIT');
 for(const f of ['supabase/migrations/20261111153232_arena_profiles_claim_subject.sql','supabase/migrations/20261111153756_arena_web_private_gateway.sql']){await c.query('BEGIN');await c.query(await readFile(f,'utf8'));await c.query('COMMIT');}
 if(process.env.TEST_CURRENT_SCHEMA)for(const f of ['20261111160453_arena_cpu_engine.sql','20261111164349_arena_online_rooms.sql','20261111202129_arena_online_deadlines.sql']){await c.query('BEGIN');await c.query(await readFile('supabase/migrations/'+f,'utf8'));await c.query('COMMIT');}
 const u1=randomUUID(),u2=randomUUID(),u3=randomUUID(),u4=randomUUID();for(const id of [u1,u2,u3,u4])await c.query('INSERT INTO auth.users VALUES($1)',[id]);
 await assert.rejects(()=>web(c,null,'me'),/SESION_REQUERIDA/);
 const r1=await web(c,u1,'register',{alias:'Alice'});const r2=await web(c,u2,'register',{alias:'Bob'});
 assert.equal(r1.recoveryCode.length,64);assert.equal((await web(c,u1,'me')).profile.id,r1.profile.id);
 const hash=(await c.query('SELECT codigo_recuperacion_hash FROM truco_arena_der.jugador WHERE id_jugador=$1',[r1.profile.id])).rows[0].codigo_recuperacion_hash;assert.notEqual(hash,r1.recoveryCode);
 const entries=['BAS-01','BAS-02','BAS-03','BAS-04','BAS-05','BAS-06'].map(cardId=>({cardId,quantity:2}));
 const d=await web(c,u1,'saveDeck',{name:'Alice deck',entries});assert.equal((await web(c,u2,'decks')).decks.length,0);
 await assert.rejects(()=>web(c,u2,'saveDeck',{id:d.id,name:'Hacked',entries}),/MAZO_AJENO/);
 const other=await connect();let claimed;
 try{const both=await Promise.all([web(c,u3,'recover',{code:r1.recoveryCode}),web(other,u4,'recover',{code:r1.recoveryCode})]);assert.equal(both.filter(r=>r.profile).length,1);claimed=both[0].profile?u3:u4;assert.equal(both.find(r=>r.profile).profile.id,r1.profile.id);}finally{await other.end();}
 assert.equal((await web(c,claimed,'decks')).decks[0].id,d.id);
 const loser=claimed===u3?u4:u3;assert.equal((await web(c,loser,'recover',{code:r1.recoveryCode})).error,'CODIGO_INVALIDO');
 for(let i=0;i<5;i++)await web(c,loser,'recover',{code:'0'.repeat(64)});
 assert.equal((await web(c,loser,'recover',{code:'0'.repeat(64)})).error,'RECUPERACION_LIMITADA');
 const rotated=await web(c,u1,'rotate');assert.equal(rotated.recoveryCode.length,64);assert.equal((await web(c,u1,'collection')).cards.length,40);
 await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(()=>c.query('SELECT * FROM truco_arena_der.jugador'));await c.query('ROLLBACK');
 console.log('PASS profiles: Auth binding, no plaintext, own data, concurrent single-use recovery, persistent throttle, rotation, private tables');
}finally{await c.end();await db.stop();}
