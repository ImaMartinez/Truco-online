import {isolated} from './isolated.mjs';
import {applyCurrent} from './current-schema.mjs';
import {randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {CpuWorker} from '../../backend/src/cpu/worker.ts';
const env=await isolated(),c=env.admin,results=[];
async function tx(client,uid,query,args){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);const r=(await client.query(query,args)).rows[0].v;await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}
const web=(p,op,data={},client=c)=>tx(client,p.uid,'SELECT public.ta_web($1,$2::jsonb) v',[op,JSON.stringify(data)]);
const room=(p,op,data={},client=c)=>tx(client,p.uid,'SELECT public.ta_rooms($1,$2::jsonb) v',[op,JSON.stringify(data)]);
const start=async(p)=>{const s=await tx(c,p.uid,'SELECT public.ta_start_cpu($1,$2,$3,false) v',[randomUUID(),p.deck,'NORMAL']);delete s.operation;return s;};
const state=(p,id)=>web(p,'state',{id});
const close=(p,s,key=randomUUID(),client=c)=>web(p,'abandon',{id:s.id,expectedVersion:s.version,requestId:key},client);
const create=(p,game,key=randomUUID(),client=c)=>room(p,'create',{deckId:p.deck,requestId:key,...(game?{replaceCpuGameId:game.id}:{})},client);
const join=(p,r,game,key=randomUUID(),client=c)=>room(p,'join',{deckId:p.deck,code:r.code,requestId:key,...(game?{replaceCpuGameId:game.id}:{})},client);
async function person(size=12){const uid=randomUUID();await c.query('INSERT INTO auth.users VALUES($1)',[uid]);const p={uid,...(await web({uid},'register',{alias:'close-qa-'+randomUUID().slice(0,12)})).profile};const cards=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8')).cards;const d=await web(p,'saveDeck',{name:'Lifecycle',entries:cards.slice(0,size/2).map(k=>({cardId:k.id,quantity:2}))});return {...p,deck:d.id};}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
try{
 await applyCurrent(c);
 await check('CPU close preserves cards/history, closes open turn, increments version and awards opponent',async()=>{
  const p=await person(),s=await start(p),key=randomUUID();const before=(await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida')).rows[0].n;
  const end=await close(p,s,key);assert.equal(end.status,'finished');assert.equal(end.reason,'ABANDONO');assert.equal(end.winnerPosition,3-s.players.find(x=>x.id===p.id).position);assert.equal(end.version,s.version+1);assert.equal((await close(p,s,key)).operation.replayed,true);assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida')).rows[0].n,before);
  assert.equal((await c.query('SELECT count(*)::int n FROM truco_arena_der.turno WHERE id_partida=$1 AND fecha_cierre IS NULL',[s.id])).rows[0].n,0);assert.equal((await web(p,'history')).duels.find(g=>g.id===s.id).reason,'ABANDONO');
 });
 await check('close rejects foreign identities, stale version and reused key; concurrent retry closes once',async()=>{
  const a=await person(),b=await person(),s=await start(a),key=randomUUID();await assert.rejects(()=>close(b,s),/AJENA/);await assert.rejects(()=>close(a,{...s,version:s.version+1}),/DESACTUALIZADO/);
  const other=await env.connect();try{const both=await Promise.all([close(a,s,key),close(a,s,key,other)]);assert.equal(both.filter(x=>x.operation.replayed).length,1);}finally{await other.end();}
  const next=await start(a);await assert.rejects(()=>close(a,next,key),/CLAVE_REUTILIZADA/);assert.equal((await state(a,next.id)).status,'active');
 });
 await check('create requires consent; confirmed exact CPU closes atomically and retry cannot close a newer game',async()=>{
  const a=await person(),s=await start(a),key=randomUUID();assert.equal((await create(a)).error,'PARTIDA_ACTIVA');assert.equal((await state(a,s.id)).status,'active');
  const r=await create(a,s,key);assert.equal(r.status,'ESPERANDO');assert.equal((await state(a,s.id)).reason,'ABANDONO');assert.equal((await create(a,s,key)).id,r.id);
  await room(a,'cancel',{id:r.id});const newer=await start(a);assert.equal((await create(a,newer,key)).id,r.id);assert.equal((await state(a,newer.id)).status,'active');
 });
 await check('failed create rolls back CPU closure and receipt even after closure hook ran',async()=>{
  const a=await person(),s=await start(a),key=randomUUID();const before=await state(a,s.id),count=(await c.query('SELECT count(*) n FROM truco_arena_der.solicitud_operacion')).rows[0].n;
  const result=await room(a,'create',{deckId:'999999',requestId:key,replaceCpuGameId:s.id});assert.equal(result.error,'MAZO_AJENO');assert.deepEqual(await state(a,s.id),before);assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.solicitud_operacion')).rows[0].n,count);
 });
 await check('join replaces CPU for guest, host starts and both hands stay private',async()=>{
  const host=await person(),guest=await person(),s=await start(guest),r=await create(host),key=randomUUID();const joined=await join(guest,r,s,key);assert.equal(joined.status,'EN_CURSO');assert.equal((await state(guest,s.id)).reason,'ABANDONO');
  assert.equal((await join(guest,r,s,key)).duelId,joined.duelId);const a=await state(host,joined.duelId),b=await state(guest,joined.duelId);assert.equal(a.activePosition,1);assert.equal(a.players[1].cards.length,0);assert.equal(b.players[0].cards.length,0);
 });
 await check('invalid, expired, full or wrong-size rooms never close CPU; throttling persists',async()=>{
  const host=await person(20),guest=await person(),s=await start(guest),r=await create(host);const before=await state(guest,s.id);
  assert.equal((await join(guest,r,s)).error,'SALA_FORMATO_INCOMPATIBLE');assert.deepEqual(await state(guest,s.id),before);
  await room(host,'cancel',{id:r.id});assert.equal((await join(guest,r,s)).error,'SALA_NO_DISPONIBLE');assert.equal((await join(guest,{code:'ZZZZ-ZZZZ'},s)).error,'SALA_NO_DISPONIBLE');
  assert.equal((await c.query('SELECT sala_intentos n FROM truco_arena_der.intento_recuperacion WHERE auth_user_id=$1',[guest.uid])).rows[0].n,3);assert.deepEqual(await state(guest,s.id),before);
 });
 await check('two guests racing: only winner closes CPU; losing guest retains their exact state',async()=>{
  const host=await person(),a=await person(),b=await person(),sa=await start(a),sb=await start(b),r=await create(host),other=await env.connect();let both;
  try{both=await Promise.all([join(a,r,sa),join(b,r,sb,randomUUID(),other)]);}finally{await other.end();}assert.equal(both.filter(x=>x.duelId).length,1);
  for(const [index,p,s]of [[0,a,sa],[1,b,sb]]){const now=await state(p,s.id);if(both[index].duelId)assert.equal(now.reason,'ABANDONO');else assert.deepEqual(now,s);}
 });
 await check('failed join after closure hook rolls back the old game, new game and receipt',async()=>{
  const host=await person(),guest=await person(),s=await start(guest),r=await create(host);const before=await state(guest,s.id),count=(await c.query('SELECT count(*) n FROM truco_arena_der.partida')).rows[0].n;
  await c.query("CREATE FUNCTION public.qa_fail_room_start() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_INICIO_FALLIDO'; END $$; CREATE TRIGGER qa_fail_room_start BEFORE INSERT ON truco_arena_der.partida FOR EACH ROW EXECUTE FUNCTION public.qa_fail_room_start()");
  try{assert.equal((await join(guest,r,s)).error,'QA_INICIO_FALLIDO');assert.deepEqual(await state(guest,s.id),before);assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.partida')).rows[0].n,count);assert.equal((await room(host,'state',{id:r.id})).status,'ESPERANDO');}finally{await c.query('DROP TRIGGER qa_fail_room_start ON truco_arena_der.partida; DROP FUNCTION public.qa_fail_room_start()');}
 });
 await check('CPU worker racing with close is version-safe and cannot revive a closed game',async()=>{
  const p=await person(),worker=new CpuWorker(env.config);let s=await start(p);try{
   if(s.players.find(x=>x.position===s.activePosition).id===p.id){await web(p,'act',{id:s.id,requestId:randomUUID(),expectedVersion:s.version,action:{type:'endTurn'}});s=await state(p,s.id);}
   const cpu=await worker.state(s.id),both=await Promise.allSettled([close(p,s),worker.step(cpu,{type:'endTurn'})]);assert.ok(both.some(x=>x.status==='fulfilled'));
   const next=await state(p,s.id);if(next.status==='active')await close(p,next);assert.equal((await state(p,s.id)).reason,'ABANDONO');assert.ok(!(await worker.jobs()).includes(s.id));
  }finally{await worker.close();}
 });
 await check('switch cannot close an online or foreign game; plain online abandon still closes room',async()=>{
  const host=await person(),guest=await person(),outsider=await person(),r=await create(host),online=await join(guest,r),s=await state(guest,online.duelId);
  assert.equal((await create(guest,s)).error,'MODALIDAD_INVALIDA');assert.equal((await state(guest,s.id)).status,'active');assert.equal((await create(outsider,s)).error,'PARTIDA_AJENA');
  const end=await close(guest,s);assert.equal(end.reason,'ABANDONO');assert.equal(end.room.status,'FINALIZADA');
 });
 await check('old finished target never overwrites a different current CPU; all operations rollback',async()=>{
  const p=await person(),old=await start(p);await close(p,old);const current=await start(p);assert.equal((await create(p,old)).error,'PARTIDA_ACTIVA');assert.deepEqual(await state(p,current.id),current);
 });
 await check('helper execution remains private and table RLS/counts are unchanged',async()=>{
  for(const role of ['anon','authenticated','ta_cpu_worker']){await c.query('BEGIN; SET LOCAL ROLE '+role);await assert.rejects(()=>c.query('SELECT truco_arena_der.ta_replace_cpu_for_room(NULL,NULL,NULL)'),/permission denied/);await c.query('ROLLBACK');}
  assert.equal((await c.query("SELECT count(*)::int n FROM pg_class WHERE relnamespace='truco_arena_der'::regnamespace AND relkind='r' AND relrowsecurity")).rows[0].n,16);assert.equal((await c.query('SELECT count(*)::int n FROM truco_arena_der.carta')).rows[0].n,40);
 });
 await mkdir('artifacts/close-and-switch',{recursive:true});await writeFile('artifacts/close-and-switch/postgres.json',JSON.stringify({date:new Date().toISOString(),isolated:true,remoteWrites:0,passed:results.length,tests:results},null,2));
}finally{await c.end();await env.db.stop();}
