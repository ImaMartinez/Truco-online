// Installs the delivered SQL artifact itself, into a disposable PostgreSQL server.
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {mkdtemp,readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {CpuWorker} from '../../backend/src/cpu/worker.ts';
import {decideCpu} from '../../backend/src/cpu/policy.ts';
const file='database/postgres/install/TrucoOnline-completo.sql',sql=await readFile(file,'utf8');
const directory=await mkdtemp(join(tmpdir(),'truco-install-'));
const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
const password=randomUUID(),db=new EmbeddedPostgres({databaseDir:directory,port,user:'postgres',password,persistent:true,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
await db.initialise();await db.start();
const config={host:'127.0.0.1',port,user:'postgres',password,database:'truco_arena_local'};
const connect=async(database=config.database)=>{const c=new pg.Client({...config,database});await c.connect();return c;};
let c,worker;const results=[],notices=[];
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name);};
async function tx(client,uid,body){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);const r=await body(client);await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}
const web=(p,op,data={},client=c)=>tx(client,p.uid,async c=>(await c.query('SELECT public.ta_web($1,$2::jsonb) value',[op,JSON.stringify(data)])).rows[0].value);
const rooms=(p,op,data={})=>tx(c,p.uid,async c=>(await c.query('SELECT public.ta_rooms($1,$2::jsonb) value',[op,JSON.stringify(data)])).rows[0].value);
const state=(p,id)=>web(p,'state',{id});
const act=(p,s,action,key=randomUUID(),client=c)=>web(p,'act',{id:s.id,expectedVersion:s.version,requestId:key,action},client);
async function person(name,size=12){const uid=randomUUID();await c.query('INSERT INTO auth.users(id) VALUES($1)',[uid]);const registration=await web({uid},'register',{alias:name});const p={uid,...registration.profile};const cards=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8')).cards;const d=await web(p,'saveDeck',{name:'Instalacion QA',entries:cards.slice(0,size/2).map(x=>({cardId:x.id,quantity:2}))});return {...p,deck:d.id,recoveryCode:registration.recoveryCode};}
try{
 const admin=await connect('postgres');try{await admin.query('CREATE DATABASE truco_arena_local');}finally{await admin.end();}
 c=await connect();c.on('notice',n=>notices.push(n.message));
 await check('fallo a mitad de instalacion revierte tablas y roles completamente',async()=>{
  await assert.rejects(()=>c.query(sql.replace('DO $verify$','SELECT 1/0;\nDO $verify$')),/division by zero/);await c.query('ROLLBACK');
  assert.equal((await c.query("SELECT to_regnamespace('truco_arena_der') v")).rows[0].v,null);assert.equal((await c.query("SELECT to_regnamespace('auth') v")).rows[0].v,null);
  assert.equal((await c.query("SELECT count(*)::int n FROM pg_roles WHERE rolname LIKE 'ta_%'")).rows[0].n,0);
 });
 await check('archivo completo instala en PostgreSQL 17 nuevo sin scripts externos',async()=>{await c.query(sql);assert.equal((await c.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='truco_arena_der'")).rows[0].n,16);assert.equal((await c.query("SELECT count(*)::int n FROM pg_constraint WHERE connamespace='truco_arena_der'::regnamespace AND contype='f'")).rows[0].n,28);});
 await check('consultas entregadas de verificacion funcionan sobre la instalacion',async()=>{await c.query(await readFile('database/postgres/install/Verificar-instalacion.sql','utf8'));});
 await check('40 cartas originales, tablas vacias, RLS y login CPU bloqueado sin clave',async()=>{
  const actual=(await c.query('SELECT * FROM truco_arena_der.carta ORDER BY id_carta')).rows,expected=JSON.parse(await readFile('tests/postgres/schema-baseline.json','utf8')).cards;assert.deepEqual(actual,expected.slice().sort((a,b)=>a.id_carta.localeCompare(b.id_carta)));
  assert.equal((await c.query('SELECT count(*)::int n FROM truco_arena_der.jugador')).rows[0].n,0);assert.equal((await c.query('SELECT count(*)::int n FROM auth.users')).rows[0].n,0);
  assert.equal((await c.query("SELECT count(*)::int n FROM pg_class WHERE relnamespace='truco_arena_der'::regnamespace AND relkind='r' AND relrowsecurity")).rows[0].n,16);
  assert.equal((await c.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='ta_cpu_node'")).rows[0].rolcanlogin,false);
 });
 await check('reinstalacion rechazada sin borrar ni alterar datos',async()=>{await assert.rejects(()=>c.query(sql),/INSTALACION_EXISTENTE/);await c.query('ROLLBACK');assert.equal((await c.query('SELECT count(*)::int n FROM truco_arena_der.carta')).rows[0].n,40);});
 const a=await person('Instalador A'),b=await person('Instalador B');
 await check('perfiles, coleccion propia, mazos y recuperacion de un solo uso',async()=>{
  assert.equal((await web(a,'collection')).cards.length,40);assert.equal((await web(b,'decks')).decks.length,1);await assert.rejects(()=>web(b,'saveDeck',{id:a.deck,name:'Intruso',entries:[]}),/MAZO_AJENO/);
  const uid=randomUUID(),secondUid=randomUUID();await c.query('INSERT INTO auth.users(id) VALUES($1),($2)',[uid,secondUid]);const recovered=await web({uid},'recover',{code:a.recoveryCode});assert.equal(recovered.profile.id,a.id);assert.notEqual(recovered.recoveryCode,a.recoveryCode);assert.equal((await web({uid:secondUid},'recover',{code:a.recoveryCode})).error,'CODIGO_INVALIDO');
 });
 worker=new CpuWorker(config);const cards=(await c.query('SELECT truco_arena_der.ta_cpu_catalog() value')).rows[0].value;
 for(const difficulty of ['FACIL','NORMAL','DIFICIL'])await check('CPU '+difficulty+': partida completa con worker y reglas existentes',async()=>{
  const size=difficulty==='FACIL'?12:20,owner=size===12?b:await person('Instalador '+difficulty,size);
  let s=await tx(c,owner.uid,async c=>(await c.query('SELECT public.ta_start_cpu($1,$2,$3,false) value',[randomUUID(),owner.deck,difficulty])).rows[0].value);let steps=0;
  assert.equal((await c.query('SELECT count(*)::int n FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE pp.id_partida=$1',[s.id])).rows[0].n,size*2);
  while(s.status==='active'){assert.ok(steps++<250);if(s.players.find(p=>p.position===s.activePosition).id===s.cpuPlayerId){const cpu=await worker.state(s.id);await worker.step(cpu,decideCpu(cpu,cards,cpu.cpuDifficulty));}else await act(owner,s,{type:'endTurn'});s=await state(owner,s.id);assert.ok(s.players.find(p=>p.id===s.cpuPlayerId).cards.every(x=>x.zone!=='MANO'));}
  assert.ok(['VIDA_CERO','LIMITE_TURNOS'].includes(s.reason));assert.ok((await web(owner,'history')).duels.some(g=>g.id===s.id));
 });
 let room,game;
 await check('sala privada, anfitrion inicia, 24 copias y manos privadas',async()=>{
  room=await rooms(a,'create',{requestId:randomUUID(),deckId:a.deck});assert.match(room.code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);room=await rooms(b,'join',{requestId:randomUUID(),code:room.code,deckId:b.deck});game=room.duelId;const s=await state(a,game);assert.equal(s.activePosition,1);assert.equal(s.players[1].cards.length,0);assert.equal(s.players[0].cards.length,3);assert.equal(Date.parse(s.onlineTimer.deadlineAt)-Date.parse(s.onlineTimer.openedAt),15000);
 });
 await check('invocacion, turno ajeno, idempotencia y concurrencia',async()=>{
  let s=await state(a,game);await assert.rejects(()=>act(b,s,{type:'endTurn'}),/TURNO_AJENO/);
  while(s.turn<9){await act(s.activePosition===1?a:b,s,{type:'endTurn'});s=await state(a,game);}
  const key=randomUUID(),copy=s.players[0].cards.find(x=>cards.find(k=>k.id===x.cardId).cost<=s.players[0].energy);assert.ok(copy);s=await act(a,s,{type:'play',instanceId:copy.id});assert.equal(s.players[0].cards.find(x=>x.id===copy.id).zone,'CAMPO');
  const other=await connect();try{const both=await Promise.all([act(a,s,{type:'endTurn'},key),act(a,s,{type:'endTurn'},key,other)]);assert.equal(both.filter(x=>x.operation.replayed).length,1);}finally{await other.end();}assert.equal((await state(b,game)).turn,10);
 });
 await check('vencimiento servidor e inactividad sin Cron: tick manual controlado',async()=>{
  // Move only this isolated test turn into the past; do not replace engine routines.
  for(let i=0;i<5;i++){await c.query("UPDATE truco_arena_der.turno SET fecha_apertura=(clock_timestamp() AT TIME ZONE 'UTC')-interval '16 seconds' WHERE id_partida=$1 AND fecha_cierre IS NULL",[game]);await c.query('BEGIN; SET LOCAL ROLE ta_timer_runner');await c.query('SELECT truco_arena_der.ta_online_tick()');await c.query('COMMIT');}
  const s=await state(a,game);assert.equal(s.status,'finished');assert.equal(s.reason,'INACTIVIDAD');assert.equal(s.winnerPosition,1);
 });
 await check('roles de navegador y CPU sin lectura de manos ni DML directo',async()=>{
  for(const role of ['anon','authenticated','ta_cpu_node']){await c.query('BEGIN; SET LOCAL ROLE '+role);await assert.rejects(()=>c.query('SELECT * FROM truco_arena_der.copia_carta_partida'));await c.query('ROLLBACK');await c.query('BEGIN; SET LOCAL ROLE '+role);await assert.rejects(()=>c.query('UPDATE truco_arena_der.participante_partida SET vida_heroe=0'));await c.query('ROLLBACK');}
 });
 await worker.close();worker=undefined;const snapshot=await state(b,game);await c.end();c=undefined;await db.stop();await db.start();c=await connect();
 await check('persistencia al reiniciar PostgreSQL',async()=>{const restored=await state(b,game);assert.notEqual(restored.onlineTimer.serverNow,snapshot.onlineTimer.serverNow);delete restored.onlineTimer.serverNow;delete snapshot.onlineTimer.serverNow;assert.deepEqual(restored,snapshot);});
 await mkdir('artifacts/postgres-install',{recursive:true});await writeFile('artifacts/postgres-install/results.json',JSON.stringify({date:new Date().toISOString(),file,sha256:createHash('sha256').update(sql).digest('hex'),version:(await c.query('SELECT version() v')).rows[0].v,passed:results.length,tests:results,cronInstalled:(await c.query("SELECT EXISTS(SELECT FROM pg_extension WHERE extname='pg_cron') v")).rows[0].v,auth:'local SQL compatibility, no real JWT/auth service tested',productionTouched:false,notices:notices.filter(n=>n.includes('CRON_'))},null,2));
}finally{if(worker)await worker.close();if(c)await c.end();await db.stop();}
