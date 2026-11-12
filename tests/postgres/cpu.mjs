import {isolated} from './isolated.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {CpuWorker} from '../../backend/src/cpu/worker.ts';
import {decideCpu} from '../../backend/src/cpu/policy.ts';
const env=await isolated();let c=env.admin;const results=[];
const migration='supabase/migrations/20261111160453_arena_cpu_engine.sql';
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name);}
async function web(client,uid,op,data={}){return tx(client,'authenticated',uid,'SELECT public.ta_web($1,$2::jsonb) value',[op,JSON.stringify(data)]);}
async function tx(client,role,uid,sql,args=[]){await client.query('BEGIN');try{await client.query('SET LOCAL ROLE '+role);if(uid)await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);const r=(await client.query(sql,args)).rows[0]?.value;await client.query('COMMIT');return r;}catch(e){await client.query('ROLLBACK');throw e;}}
const start=(client,p,key=randomUUID(),restart=false,difficulty=p.difficulty)=>tx(client,'authenticated',p.uid,'SELECT public.ta_start_cpu($1,$2,$3,$4) value',[key,p.deck,difficulty,restart]);
let worker=new CpuWorker(env.config);
try{
 await c.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
 for(const f of ['20261111151817_arena_profiles_web.sql','20261111153232_arena_profiles_claim_subject.sql','20261111153756_arena_web_private_gateway.sql','20261111160453_arena_cpu_engine.sql',...(process.env.TEST_CURRENT_SCHEMA?['20261111164349_arena_online_rooms.sql','20261111202129_arena_online_deadlines.sql']:[])]){await c.query('BEGIN');await c.query(await readFile('supabase/migrations/'+f,'utf8'));await c.query('COMMIT');}
 const cards=(await c.query('SELECT truco_arena_der.ta_cpu_catalog() value')).rows[0].value;
 const people=[];
 for(const [i,difficulty] of ['FACIL','NORMAL','DIFICIL'].entries()){
  const uid=randomUUID();await c.query('INSERT INTO auth.users VALUES($1)',[uid]);const profile=(await web(c,uid,'register',{alias:'CPU QA '+i})).profile;
  const size=i===0?12:20;const entries=cards.slice(0,size/2).map(card=>({cardId:card.id,quantity:2}));const deck=await web(c,uid,'saveDeck',{name:'CPU QA',entries});people.push({uid,profile,deck:deck.id,difficulty,size});
 }
 const games=[];
 await check('inicio 12/20, CPU propia sin Auth, copias exactas y mazos aislados',async()=>{
  for(const p of people){const s=await start(c,p);games.push(s);assert.equal(s.players.length,2);assert.equal(s.cpuDifficulty,p.difficulty.toLowerCase());assert.equal(s.players.find(x=>x.id===s.viewerPlayerId).handCount,3);assert.equal(s.players.find(x=>x.id===s.cpuPlayerId).cards.length,0);
   assert.equal(Number((await c.query('SELECT count(*) n FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE id_partida=$1',[s.id])).rows[0].n),p.size*2);
   assert.equal((await c.query('SELECT * FROM truco_arena_der.jugador_auth WHERE id_jugador=$1',[s.cpuPlayerId])).rowCount,0);assert.equal((await web(c,p.uid,'decks')).decks.length,1);
   const difference=await c.query('WITH copies AS(SELECT pp.id_mazo,cc.id_carta,count(*)::integer cantidad FROM truco_arena_der.copia_carta_partida cc JOIN truco_arena_der.participante_partida pp USING(id_participante) WHERE pp.id_partida=$1 GROUP BY pp.id_mazo,cc.id_carta) SELECT * FROM copies FULL JOIN truco_arena_der.mazo_carta mc USING(id_mazo,id_carta) WHERE id_mazo IN(SELECT id_mazo FROM truco_arena_der.participante_partida WHERE id_partida=$1) AND copies.cantidad IS DISTINCT FROM mc.cantidad',[s.id]);assert.equal(difference.rowCount,0);
  }assert.equal(new Set(games.map(s=>s.cpuPlayerId)).size,3);
 });
 await check('inicio concurrente idempotente, claves incompatibles y rollback',async()=>{
  const p=people[0],other=await env.connect(),key=randomUUID();try{const pair=await Promise.all([start(c,p,key,true),start(other,p,key,true)]);assert.equal(pair[0].id,pair[1].id);assert.equal(pair.filter(x=>x.operation.replayed).length,1);games[0]=pair[0];await assert.rejects(()=>start(c,p,key,true,'DIFICIL'),/CLAVE_REUTILIZADA/);}finally{await other.end();}
  const before=(await c.query('SELECT count(*) n FROM truco_arena_der.jugador')).rows[0].n;await assert.rejects(()=>start(c,{...p,deck:people[1].deck}),/MAZO_AJENO/);assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.jugador')).rows[0].n,before);
  assert.equal((await web(c,p.uid,'state',{id:games[0].id})).status,'active');
  await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[p.uid]);await c.query('SELECT public.ta_start_cpu($1,$2,$3,true)',[randomUUID(),p.deck,'FACIL']);await assert.rejects(()=>c.query('SELECT 1/0'));await c.query('ROLLBACK');assert.equal((await c.query('SELECT count(*) n FROM truco_arena_der.jugador')).rows[0].n,before);assert.equal((await web(c,p.uid,'state',{id:games[0].id})).status,'active');
 });
 await check('ACL worker, identidad y mano humana inaccesible a CPU',async()=>{
  await c.query('BEGIN');await c.query('SET LOCAL ROLE ta_cpu_worker');await assert.rejects(()=>c.query('SELECT * FROM truco_arena_der.copia_carta_partida'));await c.query('ROLLBACK');
  await c.query('BEGIN');await c.query('SET LOCAL ROLE authenticated');await assert.rejects(()=>c.query('SELECT truco_arena_der.ta_cpu_jobs()'));await c.query('ROLLBACK');
  await assert.rejects(()=>web(c,people[1].uid,'state',{id:games[0].id}),/AJENA/);
  for(let i=0;i<games.length;i++){let s=await web(c,people[i].uid,'state',{id:games[i].id});if(s.players.find(p=>p.position===s.activePosition).id===s.viewerPlayerId)await web(c,people[i].uid,'act',{id:s.id,expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});
   const cpu=await worker.state(s.id);assert.ok(cpu);assert.equal(cpu.viewerPlayerId,cpu.cpuPlayerId);assert.equal(cpu.players.find(p=>p.id!==cpu.cpuPlayerId).cards.some(x=>x.zone==='MANO'),false);
   await assert.rejects(()=>web(c,people[i].uid,'act',{id:cpu.id,expectedVersion:cpu.version,requestId:randomUUID(),action:{type:'endTurn'}}),/TURNO_AJENO/);
  }
 });
 await check('dos workers concurrentes avanzan una sola versión; reinicio recupera turno',async()=>{
  const s=await worker.state(games[0].id);const second=new CpuWorker(env.config);try{await Promise.all([worker.step(s,{type:'endTurn'}),second.step(s,{type:'endTurn'})]);}finally{await second.close();}
  const after=await web(c,people[0].uid,'state',{id:s.id});assert.equal(after.version,s.version+1);
  await worker.close();worker=new CpuWorker(env.config);assert.ok((await worker.jobs()).includes(games[1].id));await worker.sweep();assert.ok((await web(c,people[1].uid,'state',{id:games[1].id})).version>games[1].version);
 });
 await check('tres dificultades completan partidas legales, alternancia, daño, historial y privacidad',async()=>{
  let attacks=0,invocations=0;
  for(let i=0;i<games.length;i++){
   let s=await web(c,people[i].uid,'state',{id:games[i].id});let iterations=0;
   while(s.status==='active'){
    assert.ok(iterations++<250);const actor=s.players.find(p=>p.position===s.activePosition);
    if(actor.id===s.cpuPlayerId){const cpu=await worker.state(s.id);assert.ok(cpu);await worker.step(cpu,decideCpu(cpu,cards,cpu.cpuDifficulty));}
    else{const action=decideCpu(s,cards,'normal');await web(c,people[i].uid,'act',{id:s.id,expectedVersion:s.version,requestId:randomUUID(),action});}
    const next=await web(c,people[i].uid,'state',{id:s.id});assert.equal(next.version,s.version+1);assert.ok(next.turn<=30);assert.ok(next.players.every(p=>p.energy>=0&&p.energy<=5));assert.equal(next.players.find(p=>p.id===next.cpuPlayerId).cards.some(x=>x.zone==='MANO'),false);s=next;
   }
   attacks+=s.history.filter(h=>h.attacker).length;invocations+=s.history.filter(h=>h.invocation).length;assert.ok(['VIDA_CERO','LIMITE_TURNOS'].includes(s.reason));assert.equal((await web(c,people[i].uid,'state',{id:s.id})).status,'finished');
   const h=(await web(c,people[i].uid,'history')).duels.find(g=>g.id===s.id);assert.equal(h.cpuDifficulty,people[i].difficulty.toLowerCase());assert.ok(h.finishedAt);assert.ok(h.ownPosition);
   console.log(`  ${people[i].difficulty}: ${s.reason}, turno ${s.turn}, ${s.history.length} jugadas`);
  }assert.ok(attacks>0&&invocations>0);
 });
 await check('políticas reproducibles, fácil pasa y difícil encuentra secuencia letal',async()=>{
  const card=cards.find(c=>c.attack===1&&c.cost===1),strong=cards.find(c=>c.attack>=4);assert.ok(card&&strong);
  const s={id:'policy',version:1,turn:9,viewerPlayerId:'cpu',activePosition:1,status:'active',history:[],players:[{id:'cpu',position:1,life:10,energy:0,cards:[{id:'a',cardId:strong.id,zone:'CAMPO',health:strong.health,enteredTurn:1,lastAttackTurn:null},{id:'b',cardId:strong.id,zone:'CAMPO',health:strong.health,enteredTurn:1,lastAttackTurn:null}]},{id:'human',position:2,life:strong.attack*2,energy:0,cards:[]}]};
  assert.equal(decideCpu(s,cards,'facil',()=>0).type,'endTurn');assert.equal(decideCpu(s,cards,'dificil').type,'attack');assert.deepEqual(decideCpu(s,cards,'normal'),decideCpu(s,cards,'normal'));
  const hidden=structuredClone(s);hidden.players[1].cards=[{id:'secret',cardId:'NONEXISTENT',zone:'MANO'}];assert.deepEqual(decideCpu(hidden,cards,'dificil'),decideCpu(s,cards,'dificil'));
  const trade={...s,players:[{...s.players[0],cards:[{id:'strong',cardId:'ORO-01',zone:'CAMPO',health:3,enteredTurn:1,lastAttackTurn:null},{id:'weak',cardId:'BAS-05',zone:'CAMPO',health:2,enteredTurn:1,lastAttackTurn:null}]},{...s.players[1],life:4,cards:[{id:'blocker',cardId:'BAS-04',zone:'CAMPO',health:1,enteredTurn:1,lastAttackTurn:null}]}]};
  assert.equal(decideCpu(trade,cards,'normal').attackerId,'strong');
  assert.equal(decideCpu(trade,cards,'dificil').attackerId,'weak'); // Sacrifice the weak unit, then lethal with the strong one.
  const easy=Array.from({length:100},(_,i)=>decideCpu({...trade,version:i+1},cards,'facil'));assert.ok(easy.some(x=>x.type==='endTurn'));assert.ok(easy.some(x=>x.attackerId==='strong'));assert.ok(easy.some(x=>x.attackerId==='weak'));
 });
 await check('victoria CPU por política real y empate controlado al turno 30',async()=>{
  const p=people[0];let s=await start(c,p,randomUUID(),false,'DIFICIL');let steps=0;
  while(s.status==='active'){
   assert.ok(steps++<250);if(s.players.find(p=>p.position===s.activePosition).id===s.cpuPlayerId){const cpu=await worker.state(s.id);await worker.step(cpu,decideCpu(cpu,cards,'dificil'));}
   else await web(c,p.uid,'act',{id:s.id,expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});
   s=await web(c,p.uid,'state',{id:s.id});
  }
  assert.equal(s.winnerPosition,s.players.find(p=>p.id===s.cpuPlayerId).position);assert.equal(s.reason,'VIDA_CERO');
  s=await start(c,p,randomUUID(),false,'NORMAL');
  while(s.status==='active'){
   if(s.players.find(p=>p.position===s.activePosition).id===s.cpuPlayerId)await worker.step(await worker.state(s.id),{type:'endTurn'});
   else await web(c,p.uid,'act',{id:s.id,expectedVersion:s.version,requestId:randomUUID(),action:{type:'endTurn'}});
   s=await web(c,p.uid,'state',{id:s.id});
  }assert.equal(s.turn,30);assert.equal(s.winnerPosition,null);assert.equal(s.reason,'LIMITE_TURNOS');
 });
 await mkdir('artifacts/postgres',{recursive:true});await writeFile('artifacts/postgres/cpu-results.json',JSON.stringify({date:new Date().toISOString(),migration,isolated:true,postgres:(await c.query('select version() v')).rows[0].v,passed:results.length,tests:results},null,2));
}finally{await worker.close();await c.end();await env.db.stop();}
