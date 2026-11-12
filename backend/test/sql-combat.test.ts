import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

if(process.env.DB_NAME!=='truco_arena_dev'||!['127.0.0.1','localhost'].includes(process.env.DB_HOST??'127.0.0.1')) throw new Error('Solo truco_arena_dev en XAMPP local.');
const root=new URL('../../',import.meta.url);
let admin:Connection,appSql:Connection,child:ChildProcess|undefined,base:string,port:number;
const types=['ESP-02','COP-02','ESP-04','ESP-05','BAS-06','BAS-04'];
const entries=types.map(cardId=>({cardId,quantity:2}));
async function rows(sql:string,values:any[]=[]):Promise<any[]>{return (await admin.execute<RowDataPacket[]>(sql,values))[0];}
async function n(sql:string,values:any[]=[]){return Number(Object.values((await rows(sql,values))[0])[0]);}
async function request(path:string,body?:unknown){const r=await fetch(`${base}/api${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json() as any};}
async function start(){
  child=spawn(process.execPath,[fileURLToPath(new URL('backend/dist/backend/src/server.js',root))],{cwd:root,env:{...process.env,ARENA_STORAGE:'mariadb',PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout?.on('data',d=>output+=String(d));child.stderr?.on('data',d=>output+=String(d));
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error(`Backend terminó: ${output}`);try{const r=await fetch(`${base}/api/health`);if(r.ok){assert.equal((await r.json()).storage,'mariadb');return;}}catch{}await delay(100);}throw new Error('Backend SQL no inició.');
}
async function stop(){if(child&&child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}child=undefined;}
before(async()=>{
  const cfg={host:process.env.DB_HOST,port:Number(process.env.DB_PORT??3306),database:'truco_arena_dev'};
  admin=await mysql.createConnection({...cfg,user:process.env.DB_ADMIN_USER??'root',password:process.env.DB_ADMIN_PASSWORD??''});
  appSql=await mysql.createConnection({...cfg,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
  await appSql.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
  const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');const address=socket.address();assert.ok(address&&typeof address==='object');port=address.port;await new Promise<void>(r=>socket.close(()=>r()));base=`http://127.0.0.1:${port}`;await start();
});
after(async()=>{await stop();await appSql?.end();await admin?.end();});
async function fresh(){
  const players=[],decks=[];
  for(let i=0;i<2;i++){
    const p=await request('/players',{alias:`combate-${randomUUID().slice(0,25)}`});assert.equal(p.status,201);players.push(p.data);
    const d=await request('/decks',{ownerId:p.data.id,name:'Mazo combate',entries});assert.equal(d.status,201);decks.push(d.data);
  }
  const r=await request('/duels',{scenario:'inicio',playerIds:players.map(p=>p.id),deckIds:decks.map(d=>d.id),requestId:randomUUID()});assert.equal(r.status,201,JSON.stringify(r.data));return r.data;
}
const actor=(s:any)=>s.players.find((p:any)=>p.id===s.activePlayerId);
const rival=(s:any)=>s.players.find((p:any)=>p.id!==s.activePlayerId);
const find=(s:any,id:string)=>s.players.flatMap((p:any)=>[...p.hand,...p.field,...(p.discard??[])]).find((c:any)=>c.id===id);
function input(s:any,action:any,key=randomUUID()){return{expectedVersion:s.version,actorId:s.activePlayerId,requestId:key,action};}
async function act(s:any,action:any){const r=await request(`/duels/${s.id}/actions`,input(s,action));assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function pass(s:any){return act(s,{type:'endTurn'});}
async function advance(s:any,turn:number){while(s.turn<turn){assert.equal(s.status,'active');s=await pass(s);}assert.equal(s.turn,turn);return s;}
async function play(s:any,cardId:string){const c=actor(s).hand.find((c:any)=>c.cardId===cardId);assert.ok(c,`Falta ${cardId} en turno ${s.turn}`);return{state:await act(s,{type:'play',instanceId:c.id}),id:c.id};}
async function get(id:string){const r=await request(`/duels/${id}`);assert.equal(r.status,200);return r.data;}
async function unchanged(s:any,body:any){const before=await get(s.id);const r=await request(`/duels/${s.id}/actions`,body);assert.ok(r.status>=400&&r.status<500,JSON.stringify(r));assert.deepEqual(await get(s.id),before);return r;}
async function dual(a='ESP-02',b='COP-02'){
  let s=await advance(await fresh(),19);const first=await play(s,a);s=await pass(first.state);const second=await play(s,b);s=await pass(second.state);return{s,a:first.id,b:second.id};
}
async function eventCounts(id:string){return rows('SELECT j.id_jugada,j.id_turno,j.orden_en_turno,i.id_copia,a.id_copia_atacante,a.id_copia_objetivo,a.id_participante_objetivo,a.vida_previa_atacante,a.vida_previa_objetivo,s.tipo_operacion,s.version_resultante FROM jugada j JOIN turno t ON t.id_turno=j.id_turno JOIN solicitud_operacion s ON s.clave_reintento=j.clave_reintento LEFT JOIN invocacion i ON i.id_jugada=j.id_jugada LEFT JOIN ataque a ON a.id_jugada=j.id_jugada WHERE t.id_partida=? ORDER BY t.numero_global,j.orden_en_turno',[id]);}

test('invocación válida: energía, zona, vida base, evento/subtipo y replay aun con versión antigua',async()=>{
  let s=await advance(await fresh(),19);const card=actor(s).hand.find((c:any)=>c.cardId==='ESP-02');const command=input(s,{type:'play',instanceId:card.id});const energy=actor(s).energy;
  const r=await request(`/duels/${s.id}/actions`,command);assert.equal(r.status,200);s=r.data;assert.equal(actor(s).energy,energy-2);assert.equal(find(s,card.id).health,2);assert.equal(find(s,card.id).enteredTurn,19);assert.equal(actor(s).field.length,1);
  const events=await eventCounts(s.id);assert.equal(events.length,1);assert.equal(events[0].id_copia,Number(card.id));assert.equal(events[0].id_copia_atacante,null);
  const replay=await request(`/duels/${s.id}/actions`,command);assert.equal(replay.status,200);assert.equal(replay.data.operation.replayed,true);assert.equal(replay.data.version,s.version);assert.equal((await eventCounts(s.id)).length,1);
  await unchanged(s,input(s,{type:'play',instanceId:card.id}));
  const other=actor(s).hand[0];const reused=await request(`/duels/${s.id}/actions`,{...command,action:{type:'play',instanceId:other.id}});assert.equal(reused.status,409);
});

test('invocaciones inválidas: sin energía, campo lleno, copia rival y copia de otra partida',async()=>{
  let s=await fresh();const foreign=rival(s).hand[0];await unchanged(s,input(s,{type:'play',instanceId:foreign.id}));
  // Todas las cartas se roban por operaciones reales; no se editan vida/zonas ni catálogo para preparar escenarios.
  s=await advance(s,19);
  for(const c of ['ESP-02','COP-02','ESP-04'])s=(await play(s,c)).state;assert.equal(actor(s).energy,0);
  await unchanged(s,input(s,{type:'play',instanceId:actor(s).hand[0].id}));
  let filled=await advance(await fresh(),19);for(const c of ['ESP-04','ESP-05','BAS-04'])filled=(await play(filled,c)).state;
  assert.equal(actor(filled).energy,2);assert.equal(actor(filled).field.length,3);await unchanged(filled,input(filled,{type:'play',instanceId:actor(filled).hand[0].id}));
  // Energía 1 y campo 2: el rechazo se debe al costo, sin confundirlo con campo lleno.
  let noEnergy=await advance(await fresh(),19);noEnergy=(await play(noEnergy,'ESP-02')).state;noEnergy=(await play(noEnergy,'COP-02')).state;
  const expensive=actor(noEnergy).hand.find((c:any)=>c.cardId==='BAS-06');assert.equal(actor(noEnergy).energy,1);await unchanged(noEnergy,input(noEnergy,{type:'play',instanceId:expensive.id}));
  const outside=await fresh();await unchanged(noEnergy,input(noEnergy,{type:'play',instanceId:outside.players[0].hand[0].id}));
});

test('recién invocada no ataca; objetivo propio/ajeno a partida y héroe protegido se rechazan',async()=>{
  let s=await advance(await fresh(),19);const a=await play(s,'ESP-02');s=a.state;await unchanged(s,input(s,{type:'attack',attackerId:a.id,targetId:'hero'}));
  s=await pass(s);const b=await play(s,'COP-02');s=await pass(b.state);
  await unchanged(s,input(s,{type:'attack',attackerId:a.id,targetId:'hero'}));
  await unchanged(s,input(s,{type:'attack',attackerId:a.id,targetId:a.id}));
  await unchanged(s,input(s,{type:'attack',attackerId:b.id,targetId:a.id}));
  const outside=await fresh();await unchanged(s,input(s,{type:'attack',attackerId:a.id,targetId:outside.players[0].hand[0].id}));
});

test('daño simultáneo 3/2 contra 2/3: doble descarte; otro atacante despeja y puede atacar al héroe',async()=>{
  let s=await advance(await fresh(),19);const first=await play(s,'ESP-02');s=first.state;const second=await play(s,'ESP-04');s=await pass(second.state);const target=await play(s,'COP-02');s=await pass(target.state);
  const energy=actor(s).energy;s=await act(s,{type:'attack',attackerId:first.id,targetId:target.id});assert.equal(actor(s).energy,energy);assert.equal(actor(s).field.length,1);assert.equal(rival(s).field.length,0);assert.equal(actor(s).discardCount,1);assert.equal(rival(s).discardCount,1);
  const dead=await rows('SELECT id_copia,zona,vida_actual FROM copia_carta_partida WHERE id_copia IN (?,?)',[first.id,target.id]);assert.ok(dead.every(c=>c.zona==='DESCARTE'&&c.vida_actual===0));
  const event=(await eventCounts(s.id)).at(-1);assert.equal(event.vida_previa_atacante,2);assert.equal(event.vida_previa_objetivo,3);
  await unchanged(s,input(s,{type:'attack',attackerId:second.id,targetId:target.id}));
  s=await act(s,{type:'attack',attackerId:second.id,targetId:'hero'});assert.equal(rival(s).life,19);assert.equal(find(s,second.id).health,2);assert.equal(find(s,second.id).lastAttackTurn,21);
  await unchanged(s,input(s,{type:'attack',attackerId:second.id,targetId:'hero'}));
});

test('daño persiste y defensa no consume ataque; reinicio conserva energía, zonas, historial y ataques utilizados',async()=>{
  let {s,a,b}=await dual('ESP-04','BAS-06');s=await act(s,{type:'attack',attackerId:a,targetId:b});assert.equal(find(s,a).health,1);assert.equal(find(s,b).health,3);assert.equal(find(s,a).lastAttackTurn,21);assert.equal(find(s,b).lastAttackTurn,null);
  const confirmed=await get(s.id);const rawBefore=await eventCounts(s.id);await stop();await start();assert.deepEqual(await get(s.id),confirmed);assert.deepEqual(await eventCounts(s.id),rawBefore);
  await unchanged(s,input(s,{type:'attack',attackerId:a,targetId:b}));
  s=await pass(s);assert.equal(find(s,a).health,1);assert.equal(find(s,b).health,3);
  s=await act(s,{type:'attack',attackerId:b,targetId:a});assert.equal(find(s,b).health,2);assert.equal(find(s,b).lastAttackTurn,22);assert.equal(rival(s).discardCount,1);
});

test('concurrencia invocación: dos claves sobre misma copia, mismo UUID y último espacio del campo',async()=>{
  let s=await advance(await fresh(),19);let c=actor(s).hand.find((c:any)=>c.cardId==='ESP-04');
  const results=await Promise.all([request(`/duels/${s.id}/actions`,input(s,{type:'play',instanceId:c.id})),request(`/duels/${s.id}/actions`,input(s,{type:'play',instanceId:c.id}))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);s=await get(s.id);assert.equal(actor(s).energy,4);assert.equal((await eventCounts(s.id)).length,1);
  c=actor(s).hand.find((c:any)=>c.cardId==='ESP-05');const cmd=input(s,{type:'play',instanceId:c.id});const replays=await Promise.all([request(`/duels/${s.id}/actions`,cmd),request(`/duels/${s.id}/actions`,cmd)]);assert.ok(replays.every(r=>r.status===200));s=await get(s.id);assert.equal(actor(s).field.length,2);
  const choices=actor(s).hand.filter((c:any)=>['BAS-04','ESP-04'].includes(c.cardId));assert.ok(choices.length>=2);
  const last=await Promise.all(choices.slice(0,2).map((c:any)=>request(`/duels/${s.id}/actions`,input(s,{type:'play',instanceId:c.id}))));assert.deepEqual(last.map(r=>r.status).sort(),[200,409]);s=await get(s.id);assert.equal(actor(s).field.length,3);assert.equal(actor(s).energy,2);assert.equal((await eventCounts(s.id)).length,3);
});

test('concurrencia de ataques y respuesta perdida: una sola resolución, replay sin segundo daño',async()=>{
  let {s,a,b}=await dual('ESP-04','BAS-06');const cmd=input(s,{type:'attack',attackerId:a,targetId:b});
  const results=await Promise.all([request(`/duels/${s.id}/actions`,cmd),request(`/duels/${s.id}/actions`,{...cmd,requestId:randomUUID()})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);s=await get(s.id);assert.equal(find(s,b).health,3);
  const winner=results.find(r=>r.status===200)!.data;const winningKey=winner.operation.requestId;const retry=await request(`/duels/${s.id}/actions`,{...cmd,requestId:winningKey});assert.equal(retry.status,200);assert.equal(retry.data.operation.replayed,true);assert.equal(find(retry.data,b).health,3);assert.equal((await eventCounts(s.id)).filter(e=>e.id_copia_atacante!==null).length,1);
});

test('rollback entre Jugada e Invocacion aun si el cliente hace COMMIT tras el error',async()=>{
  let s=await advance(await fresh(),19);const c=actor(s).hand.find((c:any)=>c.cardId==='ESP-02');const before=await get(s.id),key=randomUUID();
  await admin.query(`CREATE TRIGGER ta_test_combat_inv BEFORE INSERT ON invocacion FOR EACH ROW BEGIN IF NEW.id_copia=${Number(c.id)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FALLO_SUBTIPO_PRUEBA'; END IF; END`);
  try{
    await appSql.beginTransaction();await assert.rejects(appSql.execute('CALL ta_invocar(?,?,?,?,?,?)',[key,createHash('sha256').update(key).digest('hex'),s.id,s.activePlayerId,s.version,c.id]),/FALLO_SUBTIPO_PRUEBA/);await appSql.commit();assert.deepEqual(await get(s.id),before);assert.equal(await n('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[key]),0);assert.equal((await eventCounts(s.id)).length,0);
  }finally{await appSql.rollback();await admin.query('DROP TRIGGER IF EXISTS ta_test_combat_inv');}
  const ok=await request(`/duels/${s.id}/actions`,input(s,{type:'play',instanceId:c.id},key));assert.equal(ok.status,200);
});

test('rollback de ataque fallido después del daño restaura vidas, energía, eventos y versión',async()=>{
  const {s,a,b}=await dual('ESP-04','BAS-06');const before=await get(s.id),history=await eventCounts(s.id),command=input(s,{type:'attack',attackerId:a,targetId:b});
  await admin.query(`CREATE TRIGGER ta_test_combat_attack BEFORE INSERT ON ataque FOR EACH ROW BEGIN IF NEW.id_copia_atacante=${Number(a)} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FALLO_ATAQUE_PRUEBA'; END IF; END`);
  try{const failed=await request(`/duels/${s.id}/actions`,command);assert.ok(failed.status>=400);assert.deepEqual(await get(s.id),before);assert.deepEqual(await eventCounts(s.id),history);assert.equal(await n('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[command.requestId]),0);}finally{await admin.query('DROP TRIGGER IF EXISTS ta_test_combat_attack');}
  assert.equal((await request(`/duels/${s.id}/actions`,command)).status,200);
});

test('SQL directo bajo snapshot RR previo vuelve a comprobar campo lleno y ataque utilizado',async()=>{
  let s=await advance(await fresh(),19);for(const c of ['ESP-04','ESP-05'])s=(await play(s,c)).state;
  const participant=(await rows('SELECT pp.id_participante FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=? AND m.id_jugador=?',[s.id,s.activePlayerId]))[0].id_participante;
  await appSql.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  try{
    await appSql.beginTransaction();const [previous]=await appSql.execute<RowDataPacket[]>("SELECT COUNT(*) n FROM copia_carta_partida WHERE id_participante=? AND zona='CAMPO'",[participant]);assert.equal(previous[0]!.n,2);
    s=(await play(s,'BAS-04')).state;const c=actor(s).hand.find((c:any)=>c.cardId==='ESP-04'),key=randomUUID();
    await assert.rejects(appSql.execute('CALL ta_invocar(?,?,?,?,?,?)',[key,createHash('sha256').update(key).digest('hex'),s.id,s.activePlayerId,s.version,c.id]),/CAMPO_LLENO/);await appSql.commit();assert.equal(actor(await get(s.id)).field.length,3);
    const f=await dual('ESP-04','BAS-06');s=f.s;
    await appSql.beginTransaction();const [prior]=await appSql.execute<RowDataPacket[]>('SELECT COUNT(*) n FROM ataque WHERE id_copia_atacante=?',[f.a]);assert.equal(prior[0]!.n,0);
    s=await act(s,{type:'attack',attackerId:f.a,targetId:f.b});const before=await get(s.id),retry=randomUUID();
    await assert.rejects(appSql.execute('CALL ta_atacar(?,?,?,?,?,?,?,?)',[retry,createHash('sha256').update(retry).digest('hex'),s.id,s.activePlayerId,s.version,f.a,f.b,null]),/CARTA_AGOTADA/);await appSql.commit();assert.deepEqual(await get(s.id),before);
  }finally{await appSql.rollback();await appSql.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');}
});

test('partida completa legal: victoria inmediata por VIDA_CERO y persistencia de resultado tras reiniciar',async()=>{
  let s=await advance(await fresh(),19);const ids=[];for(const card of ['ESP-02','ESP-05','ESP-04']){const played=await play(s,card);s=played.state;ids.push(played.id);}const winnerId=s.activePlayerId;
  s=await pass(s);s=await pass(s);
  while(s.status==='active'){
    if(s.activePlayerId===winnerId){for(const id of ids){s=await act(s,{type:'attack',attackerId:id,targetId:'hero'});if(s.status==='finished')break;}}
    if(s.status==='active')s=await pass(s);
  }
  assert.equal(s.turn,27);assert.equal(s.winnerId,winnerId);assert.equal(s.players.find((p:any)=>p.id!==winnerId).life,0);
  const p=(await rows('SELECT fecha_fin,motivo_cierre,ganador_posicion FROM partida WHERE id_partida=?',[s.id]))[0];assert.ok(p.fecha_fin);assert.equal(p.motivo_cierre,'VIDA_CERO');assert.equal(await n('SELECT COUNT(*) FROM turno WHERE id_partida=? AND fecha_cierre IS NULL',[s.id]),0);assert.equal(await n('SELECT MAX(numero_global) FROM turno WHERE id_partida=?',[s.id]),27);
  const completed=await get(s.id);await stop();await start();assert.deepEqual(await get(s.id),completed);
  for(const action of [{type:'endTurn'},{type:'attack',attackerId:ids[0],targetId:'hero'},{type:'play',instanceId:s.players[0].hand[0].id}])await unchanged(s,input(s,action));
  const events=await eventCounts(s.id);assert.ok(events.length>3);for(const e of events){assert.equal(Number(e.id_copia!==null)+Number(e.id_copia_atacante!==null),1);assert.equal(e.tipo_operacion,e.id_copia!==null?'INVOCAR':'ATACAR');}
  assert.ok(s.history?.length===events.length,'El DTO debe conservar todas las jugadas SQL.');
});

test('victoria durante turno 30 prevalece al límite; replay letal no repite evento ni abre turno/robo',async()=>{
  let s=await advance(await fresh(),20);const ids=[];for(const card of ['ESP-02','ESP-05','ESP-04']){const r=await play(s,card);s=r.state;ids.push(r.id);}const winner=s.activePlayerId;
  s=await advance(s,22);
  for(const turn of [22,24,26]){s=await advance(s,turn);for(const id of ids)s=await act(s,{type:'attack',attackerId:id,targetId:'hero'});}
  s=await advance(s,28);s=await act(s,{type:'attack',attackerId:ids[2],targetId:'hero'});assert.equal(rival(s).life,1);s=await advance(s,30);assert.equal(s.activePlayerId,winner);
  const command=input(s,{type:'attack',attackerId:ids[0],targetId:'hero'});const oldHands=s.players.map((p:any)=>p.hand.map((c:any)=>c.id));const before=await get(s.id);
  // El fallo ocurre después de asignar VIDA_CERO/cerrar turno y crear el padre, antes de insertar Ataque.
  await admin.query(`CREATE TRIGGER ta_test_combat_lethal BEFORE INSERT ON ataque FOR EACH ROW BEGIN IF NEW.id_copia_atacante=${Number(ids[0])} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FALLO_LETAL_PRUEBA'; END IF; END`);
  try{
    const failed=await request(`/duels/${s.id}/actions`,command);assert.ok(failed.status>=400);assert.deepEqual(await get(s.id),before);assert.equal(await n('SELECT COUNT(*) FROM turno WHERE id_partida=? AND fecha_cierre IS NULL',[s.id]),1);assert.equal(await n('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[command.requestId]),0);
  }finally{await admin.query('DROP TRIGGER IF EXISTS ta_test_combat_lethal');}
  const r=await request(`/duels/${s.id}/actions`,command);assert.equal(r.status,200);s=r.data;assert.equal(s.status,'finished');assert.equal(s.winnerId,winner);assert.equal(rival(s).life,0);assert.deepEqual(s.players.map((p:any)=>p.hand.map((c:any)=>c.id)),oldHands);
  assert.equal((await rows('SELECT motivo_cierre FROM partida WHERE id_partida=?',[s.id]))[0].motivo_cierre,'VIDA_CERO');assert.equal(await n('SELECT COUNT(*) FROM turno WHERE id_partida=?',[s.id]),30);assert.equal(await n('SELECT COUNT(*) FROM turno WHERE id_partida=? AND fecha_cierre IS NULL',[s.id]),0);
  const count=(await eventCounts(s.id)).length;const replay=await request(`/duels/${s.id}/actions`,command);assert.equal(replay.status,200);assert.equal(replay.data.operation.replayed,true);assert.equal((await eventCounts(s.id)).length,count);
  await unchanged(s,input(s,{type:'endTurn'}));
});

test('permiso de solo rutinas: Jugada y subtipos no admiten DML directo desde app',async()=>{
  for(const sql of ["INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(0,1,'00000000-0000-0000-0000-000000000000')",'DELETE FROM ataque WHERE id_jugada=0','UPDATE invocacion SET id_copia=1 WHERE id_jugada=0'])await assert.rejects(appSql.query(sql),/denied/i);
});
