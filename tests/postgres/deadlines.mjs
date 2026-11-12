import {isolated} from './isolated.mjs';
import {applyCurrent} from './current-schema.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
const env=await isolated(),c=env.admin,results=[];let ms=Date.now()+3600000;const fixtures=[];
async function clock(value=ms){ms=value;await c.query(`CREATE OR REPLACE FUNCTION truco_arena_der.ta_online_now() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT '${new Date(ms).toISOString()}'::timestamptz $$`);}
async function tx(client,role,uid,sql,args=[]){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE '+role);if(uid)await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);const r=(await client.query(sql,args)).rows[0].v;await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}
const web=(p,op,data={},client=c)=>tx(client,'authenticated',p.uid,'SELECT public.ta_web($1,$2) v',[op,JSON.stringify(data)]);
const room=(p,op,data={})=>tx(c,'authenticated',p.uid,'SELECT public.ta_rooms($1,$2) v',[op,JSON.stringify(data)]);
const tick=(client=c)=>tx(client,'ta_timer_runner',null,'SELECT truco_arena_der.ta_online_tick() v');
const state=(f,p=f.a,client=c)=>web(p,'state',{id:f.id},client);
const act=(p,s,action,key=randomUUID(),client=c)=>web(p,'act',{id:s.id,expectedVersion:s.version,requestId:key,action},client);
const abandon=(p,s,key=randomUUID(),client=c)=>web(p,'abandon',{id:s.id,expectedVersion:s.version,requestId:key},client);
async function person(){const uid=randomUUID();await c.query('INSERT INTO auth.users VALUES($1)',[uid]);const p={uid,...(await web({uid},'register',{alias:'timer-'+randomUUID().slice(0,12)})).profile};const cards=JSON.parse(await readFile('backend/src/demo/catalog.json')).cards.filter(x=>x.cost===1).slice(0,6);p.deck=(await web(p,'saveDeck',{name:'Timer 12',entries:cards.map(x=>({cardId:x.id,quantity:2}))})).id;return p;}
async function fixture(){const a=await person(),b=await person();const r=await room(a,'create',{deckId:a.deck,requestId:randomUUID()});const joined=await room(b,'join',{code:r.code,deckId:b.deck,requestId:randomUUID()});assert.ok(joined.duelId);const f={id:joined.duelId,a,b,room:r.id};fixtures.push(f);return f;}
async function expire(f){const s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));await tick();return state(f);}
async function pass(f){const s=await state(f);await act(s.activePosition===1?f.a:f.b,s,{type:'endTurn'});return state(f);}
async function check(name,fn){try{await fn();results.push(name);console.log('PASS '+name);}finally{for(const f of fixtures){const s=await state(f);if(s.status==='active')await abandon(f.a,s);}fixtures.length=0;}}
try{
 await applyCurrent(c);await clock();
 await check('plazo fijo, UTC y reloj servidor: 14.999 acepta; 15.000 rechaza sin cambios',async()=>{
  const f=await fixture();let s=await state(f);const opening=Date.parse(s.onlineTimer.openedAt),deadline=Date.parse(s.onlineTimer.deadlineAt);assert.equal(deadline-opening,15000);assert.equal(opening,ms);
  await clock(opening+14999);const copy=s.players[0].cards.find(x=>x.zone==='MANO'),key=randomUUID();s=await act(f.a,s,{type:'play',instanceId:copy.id},key);assert.equal(Date.parse(s.onlineTimer.deadlineAt),deadline);
  await clock(deadline);const replay=await act(f.a,{...s,version:1},{type:'play',instanceId:copy.id},key);assert.equal(replay.operation.replayed,true);
  const before=await state(f);await assert.rejects(()=>act(f.a,before,{type:'endTurn'}),/TURNO_VENCIDO/);assert.deepEqual((await state(f)).players,before.players);assert.equal((await state(f)).version,before.version);
  s=await expire(f);assert.equal(s.turn,2);assert.equal(s.onlineTimer.lastClosure.reason,'TIEMPO_AGOTADO');assert.equal(s.onlineTimer.inactivity[0].count,0);
 });
 await check('dos workers simultáneos cierran una vez; receipt, versión y reparto únicos',async()=>{
  const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));const other=await env.connect();try{const both=await Promise.all([tick(),tick(other)]);assert.equal(both.reduce((n,r)=>n+r.processed,0),1);}finally{await other.end();}
  const next=await state(f);assert.equal(next.version,s.version+1);assert.equal(next.turn,2);assert.equal((await tick()).processed,0);
  assert.equal(Number((await c.query("SELECT count(*) n FROM truco_arena_der.solicitud_operacion WHERE id_partida=$1 AND tipo_operacion='EXPIRAR_TURNO'",[f.id])).rows[0].n),1);
  assert.equal(Number((await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE pp.id_partida=$1',[f.id])).rows[0].n),24);
 });
 await check('acción bloqueada antes del plazo pero recibida por motor tarde se rechaza',async()=>{
  const f=await fixture(),s=await state(f),other=await env.connect();await clock(Date.parse(s.onlineTimer.deadlineAt)-1);await c.query('BEGIN');await c.query('SELECT 1 FROM truco_arena_der.partida WHERE id_partida=$1 FOR UPDATE',[f.id]);
  const pending=act(f.a,s,{type:'endTurn'},randomUUID(),other);pending.catch(()=>{});
  const ctl=await env.connect();try{await ctl.query(`CREATE OR REPLACE FUNCTION truco_arena_der.ta_online_now() RETURNS timestamptz LANGUAGE sql VOLATILE SET search_path=pg_catalog AS $$ SELECT '${s.onlineTimer.deadlineAt}'::timestamptz $$`);ms=Date.parse(s.onlineTimer.deadlineAt);await c.query('COMMIT');await assert.rejects(()=>pending,/TURNO_VENCIDO/);}finally{await other.end();await ctl.end();}
  assert.equal((await state(f)).version,1);await tick();assert.equal((await state(f)).version,2);
 });
 await check('vencimiento compite con invocación/fin manual; el vencido no escribe',async()=>{
  for(const kind of ['play','endTurn']){const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));const other=await env.connect();const action=kind==='play'?{type:'play',instanceId:s.players[0].cards[0].id}:{type:'endTurn'};
   try{const r=await Promise.allSettled([act(f.a,s,action),tick(other)]);assert.equal(r[0].status,'rejected');assert.match(r[0].reason.message,/VENCIDO|DESACTUALIZADO|TURNO_AJENO/);assert.equal(r[1].status,'fulfilled');}finally{await other.end();}
   const next=await state(f);assert.equal(next.turn,2);assert.equal(next.version,2);assert.equal(next.history.length,0);
  }
 });
 await check('fin voluntario previo al plazo gana sin sumar inactividad',async()=>{
  const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt)-1);const other=await env.connect();try{await Promise.all([act(f.a,s,{type:'endTurn'}),tick(other)]);}finally{await other.end();}const next=await state(f);assert.equal(next.version,2);assert.equal(next.onlineTimer.lastClosure.reason,'MANUAL');assert.equal(next.onlineTimer.inactivity[0].count,0);
 });
 await check('caída prolongada del scheduler: recupera pendiente y abre un turno nuevo completo, sin cierres retroactivos',async()=>{
  const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt)+3600000);await tick();const next=await state(f);
  assert.equal(next.turn,2);assert.equal(next.version,2);assert.equal(Date.parse(next.onlineTimer.openedAt),ms);assert.equal(Date.parse(next.onlineTimer.deadlineAt)-ms,15000);assert.equal((await tick()).processed,0);assert.equal((await state(f)).version,2);
 });
 await check('tres turnos propios consecutivos: advertencias 1/2, derrota 3, sala e historial',async()=>{
  const f=await fixture();for(const [turn,count] of [[2,1],[3,1],[4,2],[5,2]]){const s=await expire(f);assert.equal(s.turn,turn);assert.equal(s.onlineTimer.inactivity[0].count,count);assert.equal(s.status,'active');}
  const s=await expire(f);assert.equal(s.status,'finished');assert.equal(s.reason,'INACTIVIDAD');assert.equal(s.winnerPosition,2);assert.equal(s.onlineTimer.inactivity[0].count,3);assert.equal(s.room.status,'FINALIZADA');
  for(const p of [f.a,f.b]){const h=(await web(p,'history')).duels.find(x=>x.id===f.id);assert.equal(h.reason,'INACTIVIDAD');assert.equal(h.winnerPosition,2);}
 });
 await check('jugada válida reinicia inmediatamente; vencer después de jugar no suma',async()=>{
  const f=await fixture();await expire(f);await pass(f);await expire(f);await pass(f);let s=await state(f);assert.equal(s.onlineTimer.inactivity[0].count,2);
  const opponent=await state(f,f.b);await assert.rejects(()=>act(f.a,s,{type:'play',instanceId:opponent.players[1].cards[0].id}),/COPIA_AJENA/);assert.equal((await state(f)).onlineTimer.inactivity[0].count,2);
  s=await act(f.a,s,{type:'play',instanceId:s.players[0].cards.find(x=>x.zone==='MANO').id});assert.equal(s.onlineTimer.inactivity[0].count,0);s=await expire(f);assert.equal(s.onlineTimer.inactivity[0].count,0);await pass(f);s=await expire(f);assert.equal(s.onlineTimer.inactivity[0].count,1);assert.equal(s.status,'active');
 });
 await check('fin manual reinicia racha y turno 30 agotado conserva empate/límite',async()=>{
  const f=await fixture();await expire(f);await pass(f);let s=await pass(f);assert.equal(s.onlineTimer.inactivity[0].count,0);await pass(f);s=await expire(f);assert.equal(s.onlineTimer.inactivity[0].count,1);
  while((s=await state(f)).turn<30)await pass(f);s=await expire(f);assert.equal(s.reason,'LIMITE_TURNOS');assert.equal(s.turn,30);assert.equal(s.winnerPosition,null);assert.equal(s.room.status,'FINALIZADA');
 });
 await check('abandono por participante fuera de turno, replay y rechazo de ajeno',async()=>{
  const f=await fixture(),s=await state(f),stranger=await person(),key=randomUUID();await assert.rejects(()=>abandon(stranger,s),/AJENA/);
  const ended=await abandon(f.b,s,key);assert.equal(ended.reason,'ABANDONO');assert.equal(ended.winnerPosition,1);assert.equal(ended.version,2);assert.equal(ended.room.status,'FINALIZADA');assert.equal((await abandon(f.b,s,key)).operation.replayed,true);assert.equal((await state(f)).history.length,0);
 });
 await check('abandono concurrente y timeout/abandono no producen cierres duplicados',async()=>{
  const f=await fixture(),s=await state(f),other=await env.connect();try{const r=await Promise.allSettled([abandon(f.a,s,randomUUID()),abandon(f.b,s,randomUUID(),other)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);}finally{await other.end();}assert.equal((await state(f)).version,2);
  const f2=await fixture(),s2=await state(f2);await clock(Date.parse(s2.onlineTimer.deadlineAt));const peer=await env.connect();try{await Promise.allSettled([abandon(f2.b,s2),tick(peer)]);}finally{await peer.end();}const next=await state(f2);assert.equal(next.version,2);assert.ok(next.reason==='ABANDONO'||next.status==='active');
 });
 await check('fallo parcial revierte cierre/robo/versión y siguiente tick recupera',async()=>{
  const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));await c.query("CREATE FUNCTION public.test_expiry_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo_operacion='EXPIRAR_TURNO' THEN RAISE EXCEPTION 'TEST_FAILURE'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_expiry_failure BEFORE INSERT ON truco_arena_der.solicitud_operacion FOR EACH ROW EXECUTE FUNCTION public.test_expiry_failure()");
  try{const r=await tick();assert.equal(r.failed,1);const next=await state(f);assert.equal(next.version,s.version);assert.deepEqual(next.players,s.players);assert.equal(next.turn,s.turn);}finally{await c.query('DROP TRIGGER test_expiry_failure ON truco_arena_der.solicitud_operacion; DROP FUNCTION public.test_expiry_failure()');}
  assert.equal((await tick()).processed,1);assert.equal((await state(f)).version,2);
 });
 await check('salas paralelas independientes, PC sin plazo y ACL mínimos',async()=>{
  const f=await fixture(),other=await fixture();const s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));await tick();assert.equal((await state(f)).version,2);assert.equal((await state(other)).version,2);
  const p=await person();const pc=await tx(c,'authenticated',p.uid,'SELECT public.ta_start_cpu($1,$2,$3) v',[randomUUID(),p.deck,'NORMAL']);assert.equal(pc.onlineTimer,undefined);await clock(ms+100000);await tick();assert.equal((await web(p,'state',{id:pc.id})).version,pc.version);
  const closed=await abandon(p,pc);assert.equal(closed.reason,'ABANDONO');assert.equal(closed.onlineTimer,undefined);
  for(const role of ['anon','authenticated','ta_cpu_worker']){await c.query('BEGIN');await c.query('SET LOCAL ROLE '+role);await assert.rejects(()=>c.query('SELECT truco_arena_der.ta_online_tick()'));await c.query('ROLLBACK');}
  await c.query('BEGIN');await c.query('SET LOCAL ROLE ta_timer_runner');await assert.rejects(()=>c.query('UPDATE truco_arena_der.partida SET version=99'));await c.query('ROLLBACK');
  assert.equal(Number((await c.query("SELECT count(*) n FROM pg_tables WHERE schemaname='truco_arena_der'")).rows[0].n),16);
 });
 await check('lectura privada y temporizador comparten versión mientras vence un turno concurrentemente',async()=>{
  const f=await fixture(),s=await state(f);await clock(Date.parse(s.onlineTimer.deadlineAt));
  const definition=(await c.query("SELECT pg_get_functiondef('truco_arena_der.ta_online_meta(bigint)'::regprocedure) d")).rows[0].d;
  // An isolated-only barrier between the inner state read and timer metadata.
  await c.query(definition.replace('; BEGIN','; BEGIN PERFORM pg_advisory_xact_lock(909010);'));
  const reader=await env.connect(),expiry=await env.connect();let reading,expiring;
  try{
   await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(909010)');
   reading=state(f,f.a,reader);reading.catch(()=>{});
   let waiting=false;for(let i=0;i<100;i++){waiting=(await c.query("SELECT EXISTS(SELECT FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted) b",[reader.processID])).rows[0].b;if(waiting)break;await delay(5);}assert.ok(waiting,'reader reached timer barrier');
   expiring=expiry.query('SELECT truco_arena_der.ta_online_expire($1,$2) v',[f.id,s.onlineTimer.turnId]);expiring.catch(()=>{});
   let blocked=false;for(let i=0;i<100;i++){blocked=(await c.query('SELECT $1::integer=ANY(pg_blocking_pids($2)) b',[reader.processID,expiry.processID])).rows[0].b;if(blocked)break;await delay(5);}assert.ok(blocked,'expiration waits for the private snapshot shared mutex');
   await c.query('COMMIT');const before=await reading;await expiring;assert.equal(before.version,1);assert.equal(before.onlineTimer.turnId,s.onlineTimer.turnId);
  }finally{await c.query('ROLLBACK');await Promise.allSettled([reading,expiring].filter(Boolean));await c.query(definition);await reader.end();await expiry.end();}
  const next=await state(f);assert.equal(next.version,2);assert.notEqual(next.onlineTimer.turnId,s.onlineTimer.turnId);
 });
 await mkdir('artifacts/postgres',{recursive:true});await writeFile('artifacts/postgres/deadline-results.json',JSON.stringify({date:new Date().toISOString(),isolated:true,clock:'SQL helper replaced only in isolated cluster; production has no client clock override',passed:results.length,tests:results},null,2));
}finally{await c.end();await env.db.stop();}
