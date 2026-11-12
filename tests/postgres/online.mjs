import {isolated} from './isolated.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const env=await isolated(),c=env.admin,results=[];
const migration='20261111164349_arena_online_rooms.sql';
async function tx(client,uid,sql,args){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);const r=(await client.query(sql,args)).rows[0].v;await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}
const web=(p,op,data={},client=c)=>tx(client,p.uid,'SELECT public.ta_web($1,$2) v',[op,JSON.stringify(data)]);
const rooms=(p,op,data={},client=c)=>tx(client,p.uid,'SELECT public.ta_rooms($1,$2) v',[op,JSON.stringify(data)]);
const create=(p,key=randomUUID())=>rooms(p,'create',{deckId:p.deck,requestId:key});
const join=(p,r,client=c,key=randomUUID())=>rooms(p,'join',{code:r.code,deckId:p.deck,requestId:key},client);
const state=(p,id)=>web(p,'state',{id});
const act=(p,s,action,key=randomUUID())=>web(p,'act',{id:s.id,expectedVersion:s.version,requestId:key,action});
async function person(size=12){const uid=randomUUID();await c.query('INSERT INTO auth.users VALUES($1)',[uid]);const p={uid,...(await web({uid},'register',{alias:'online-'+randomUUID().slice(0,12)})).profile};const cards=JSON.parse(await readFile('backend/src/demo/catalog.json')).cards;const d=await web(p,'saveDeck',{name:'Online QA',entries:cards.slice(0,size/2).map(x=>({cardId:x.id,quantity:2}))});p.deck=d.id;return p;}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
try{
 await c.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
 for(const f of ['20261111151817_arena_profiles_web.sql','20261111153232_arena_profiles_claim_subject.sql','20261111153756_arena_web_private_gateway.sql','20261111160453_arena_cpu_engine.sql',migration,...(process.env.TEST_CURRENT_SCHEMA?['20261111202129_arena_online_deadlines.sql']:[])]){await c.query('BEGIN');await c.query(await readFile('supabase/migrations/'+f,'utf8'));await c.query('COMMIT');}
 const a=await person(),b=await person(),third=await person(),large=await person(20);let room,game;
 await check('crear sin partida, código CSPRNG, replay y reserva de mazo',async()=>{
  const n=(await c.query('select count(*) n from truco_arena_der.partida')).rows[0].n,key=randomUUID();room=await create(a,key);assert.equal(room.status,'ESPERANDO');assert.match(room.code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);assert.equal(room.duelId,null);assert.equal(room.host.deckSize,12);assert.equal((await create(a,key)).id,room.id);assert.equal((await c.query('select count(*) n from truco_arena_der.partida')).rows[0].n,n);
  assert.equal((await create(a)).error,'SALA_PENDIENTE');assert.equal((await web(a,'decks')).decks.length,1);
  await assert.rejects(()=>web(a,'deleteDeck',{id:a.deck}),/MAZO_RESERVADO/);
  const cpu=await tx(c,a.uid,'SELECT public.ta_start_cpu($1,$2,$3) v',[randomUUID(),a.deck,'NORMAL']).catch(e=>({error:e.message}));assert.equal(cpu.error,'SALA_PENDIENTE');
 });
 await check('código normalizado, dueño, formato y datos mínimos en búsqueda',async()=>{
  const lookup=await rooms(b,'lookup',{code:room.code.toLowerCase().replace('-',' ')});assert.equal(lookup.deckSize,12);assert.equal(lookup.hostAlias,a.alias);assert.equal(lookup.host,undefined);
  assert.equal((await join(a,room)).error,'SALA_PROPIA');assert.equal((await join(large,room)).error,'SALA_FORMATO_INCOMPATIBLE');assert.equal((await rooms(b,'join',{code:room.code,deckId:a.deck,requestId:randomUUID()})).error,'MAZO_AJENO');assert.equal((await rooms(third,'state',{id:room.id})).error,'SALA_AJENA');
 });
 await check('unión simultánea: solo un invitado; anfitrión posición 1 y 24 copias',async()=>{
  const other=await env.connect();let pair;try{pair=await Promise.all([join(b,room),join(third,room,other)]);}finally{await other.end();}
  assert.equal(pair.filter(x=>x.duelId).length,1);const winner=pair.find(x=>x.duelId);game=winner.duelId;room=winner;if(room.guest.id!==b.id){const tmp={...b};Object.assign(b,third);Object.assign(third,tmp);}
  const s=await state(a,game);assert.equal(s.activePosition,1);assert.equal(s.players[0].id,a.id);assert.equal(s.players[1].id,b.id);assert.equal(s.players[0].handCount,3);assert.equal(s.players[1].cards.length,0);assert.equal(s.room.code,room.code);assert.equal((await state(b,game)).players[0].cards.length,0);
  assert.equal(Number((await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE pp.id_partida=$1',[game])).rows[0].n),24);
  assert.equal((await join(third,room)).error,'SALA_NO_DISPONIBLE');
 });
 await check('acciones, turnos, reintento, concurrencia, privacidad e igualdad de snapshots',async()=>{
  let s=await state(a,game);await assert.rejects(()=>act(b,s,{type:'endTurn'}),/TURNO_AJENO/);await assert.rejects(()=>state(third,game),/AJENA/);
  const key=randomUUID();await act(a,s,{type:'endTurn'},key);assert.equal((await act(a,s,{type:'endTurn'},key)).operation.replayed,true);
  s=await state(b,game);const other=await env.connect();try{const args={id:game,expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}};const both=await Promise.all([web(b,'act',args),web(b,'act',args,other)]);assert.equal(both.filter(x=>x.operation.replayed).length,1);}finally{await other.end();}
  while((s=await state(a,game)).turn<19)await act(s.activePosition===1?a:b,s,{type:'endTurn'});
  s=await state(a,game);const src=s.players[0].cards.find(x=>x.zone==='MANO'&&x.cardId==='ESP-04');assert.ok(src);s=await act(a,s,{type:'play',instanceId:src.id});await assert.rejects(()=>act(a,s,{type:'attack',attackerId:src.id,targetId:'hero'}),/NUEVA/);await act(a,s,{type:'endTurn'});s=await state(b,game);const dst=s.players[1].cards.find(x=>x.zone==='MANO'&&x.cardId==='ESP-04');await act(b,s,{type:'play',instanceId:dst.id});s=await state(b,game);await act(b,s,{type:'endTurn'});s=await state(a,game);await act(a,s,{type:'attack',attackerId:src.id,targetId:dst.id});const sa=await state(a,game),sb=await state(b,game);assert.equal(sa.version,sb.version);assert.deepEqual(sa.history,sb.history);assert.ok(sa.history.some(x=>x.attacker));
 });
 await check('límite 30, empate, sala FINALIZADA, ambos historiales y código inutilizable',async()=>{
  let s=await state(a,game);while(s.status==='active'){await act(s.activePosition===1?a:b,s,{type:'endTurn'});s=await state(a,game);}assert.equal(s.turn,30);assert.equal(s.winnerPosition,null);assert.equal(s.room.status,'FINALIZADA');assert.equal((await rooms(a,'state',{id:room.id})).status,'FINALIZADA');
  for(const p of [a,b]){const h=(await web(p,'history')).duels.find(x=>x.id===game);assert.equal(h.status,'finished');assert.equal(h.room.code,room.code);assert.ok(h.finishedAt);}
  assert.equal((await join(third,room)).error,'SALA_NO_DISPONIBLE');await assert.rejects(()=>act(a,s,{type:'endTurn'}),/FINALIZADA/);
 });
 await check('cancelación, expiración, límite persistente y salas simultáneas',async()=>{
  const r=await create(third);assert.equal((await rooms(a,'cancel',{id:r.id})).error,'SALA_AJENA');assert.equal((await rooms(third,'cancel',{id:r.id})).status,'CANCELADA');assert.equal((await rooms(third,'cancel',{id:r.id})).status,'CANCELADA');assert.equal((await join(a,r)).error,'SALA_NO_DISPONIBLE');
  const expired=await create(third);await c.query("UPDATE truco_arena_der.sala SET fecha_creacion=now()-interval '2 hours',fecha_expiracion=now()-interval '1 hour' WHERE id_sala=$1",[expired.id]);assert.equal((await rooms(third,'state',{id:expired.id})).status,'EXPIRADA');assert.equal((await join(a,expired)).error,'SALA_NO_DISPONIBLE');
  const p=await person();for(let i=0;i<10;i++)assert.equal((await rooms(p,'lookup',{code:'ZZZZ-ZZZZ'})).error,'SALA_NO_DISPONIBLE');assert.equal((await rooms(p,'lookup',{code:'ZZZZ-ZZZZ'})).error,'SALA_INTENTOS_LIMITADOS');
  const x=await create(a),y=await create(third);assert.notEqual(x.code,y.code);assert.notEqual(x.id,y.id);assert.equal((await rooms(a,'state',{id:y.id})).error,'SALA_AJENA');await rooms(a,'cancel',{id:x.id});await rooms(third,'cancel',{id:y.id});
  assert.equal((await web(a,'collection')).cards.length,40);assert.equal((await web(a,'rotate')).recoveryCode.length,64);
 });
 await check('ACL, mismo esquema, rollback tras unión y 40 copias en formato 20',async()=>{
  const host=await person(20),guest=await person(20),r=await create(host);const before=(await c.query('SELECT count(*) n FROM truco_arena_der.partida')).rows[0].n;
  await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[guest.uid]);const joined=(await c.query('SELECT public.ta_rooms($1,$2) v',['join',JSON.stringify({code:r.code,deckId:guest.deck,requestId:randomUUID()})])).rows[0].v;assert.ok(joined.duelId);await assert.rejects(()=>c.query('SELECT 1/0'));await c.query('ROLLBACK');assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.partida')).rows[0].n,before);assert.equal((await rooms(host,'state',{id:r.id})).status,'ESPERANDO');
  const key=randomUUID(),joined2=await join(guest,r,c,key);assert.equal((await join(guest,r,c,key)).duelId,joined2.duelId);
  assert.equal(Number((await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE pp.id_partida=$1',[joined2.duelId])).rows[0].n),40);
  await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(()=>c.query('SELECT * FROM truco_arena_der.sala'));await c.query('ROLLBACK');
  await c.query('BEGIN');await c.query('SET LOCAL ROLE anon');await assert.rejects(()=>c.query("SELECT public.ta_rooms('list')"));await c.query('ROLLBACK');
  assert.equal(Number((await c.query("SELECT count(*) n FROM pg_tables WHERE schemaname='truco_arena_der'")).rows[0].n),16);
 });
 await mkdir('artifacts/postgres',{recursive:true});await writeFile('artifacts/postgres/online-results.json',JSON.stringify({date:new Date().toISOString(),migration,isolated:true,tests:results,passed:results.length},null,2));
}finally{await c.end();await env.db.stop();}
