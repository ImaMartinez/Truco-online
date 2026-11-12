import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { once } from 'node:events';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

// Pruebas reales, sin mock ni skip. Solo truco_arena_dev; cada fixture usa alias únicos.
if (process.env.DB_NAME !== 'truco_arena_dev') throw new Error('Pruebas permitidas solo en truco_arena_dev.');
if (!['127.0.0.1','localhost'].includes(process.env.DB_HOST ?? '127.0.0.1')) throw new Error('Pruebas permitidas solo en XAMPP local.');
const root = new URL('../../', import.meta.url);
let admin: Connection, appSql: Connection, child: ChildProcess | undefined;
let base: string, port: number;
const entries = ['ESP-01','ESP-02','ESP-03','ESP-04','ESP-05','ESP-06'].map(cardId=>({cardId,quantity:2}));
const entries20=[...entries,...['ESP-07','ESP-10','ESP-11','ESP-12'].map(cardId=>({cardId,quantity:2}))];
const hash = (value:unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function rows(sql:string, values:any[]=[]):Promise<any[]> { return (await admin.execute<RowDataPacket[]>(sql,values))[0]; }
async function scalar(sql:string, values:any[]=[]):Promise<number> { return Number(Object.values((await rows(sql,values))[0])[0]); }
async function start() {
  child = spawn(process.execPath, [fileURLToPath(new URL('backend/dist/backend/src/server.js',root))], {
    cwd:root, env:{...process.env,ARENA_STORAGE:'mariadb',PORT:String(port)}, stdio:['ignore','pipe','pipe'], windowsHide:true,
  });
  let log=''; child.stdout?.on('data',data=>{log+=String(data);}); child.stderr?.on('data',data=>{log+=String(data);});
  for(let i=0;i<100;i++) {
    if(child.exitCode!==null) throw new Error(`Backend terminó: ${log}`);
    try { const r=await fetch(`${base}/api/health`); if(r.ok) {assert.equal((await r.json()).storage,'mariadb');return;} } catch {}
    await delay(100);
  }
  throw new Error(`Backend no inició: ${log}`);
}
async function stop() { if(child && child.exitCode===null) {const done=once(child,'exit');child.kill();await done;} child=undefined; }
async function request(path:string, body?:unknown, method=body===undefined?'GET':'POST') {
  const r=await fetch(`${base}/api${path}`,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,data:await r.json() as any};
}
async function player() {
  const r=await request('/players',{alias:`test-${randomUUID().slice(0,25)}`}); assert.equal(r.status,201,JSON.stringify(r.data));return r.data;
}
async function fixture() {
  const players=[await player(),await player()];
  const decks=[];
  for(const p of players) { const r=await request('/decks',{ownerId:p.id,name:'Mazo test',entries});assert.equal(r.status,201,JSON.stringify(r.data));decks.push(r.data); }
  const input={scenario:'inicio',playerIds:players.map(p=>p.id),deckIds:decks.map(d=>d.id),requestId:randomUUID()};
  return {players,decks,input};
}
async function create() {const f=await fixture();const r=await request('/duels',f.input);assert.equal(r.status,201,JSON.stringify(r.data));return {...f,state:r.data};}

test('reinicio SQL directo revierte el cierre aunque el cliente confirme tras un error',async()=>{
 const f=await create();const before=(await request(`/duels/${f.state.id}`)).data;
 const key=randomUUID();await appSql.beginTransaction();
 try {
  await assert.rejects(appSql.execute('CALL ta_reiniciar_partida(?,?,?,?,?,?)',[key,'a'.repeat(64),f.players[0].id,4294967295,f.players[1].id,f.decks[1].id]),/MAZO_AJENO/);
  await appSql.commit();
 }finally{await appSql.rollback();}
 assert.deepEqual((await request(`/duels/${f.state.id}`)).data,before);
 assert.equal(await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[key]),0);
});
async function rejected(sql:string,values:any[]=[],pattern?:RegExp) {
  await assert.rejects(admin.execute(sql,values),pattern);
}
before(async()=>{
  const config={host:process.env.DB_HOST??'127.0.0.1',port:Number(process.env.DB_PORT??3306),database:'truco_arena_dev'};
  admin=await mysql.createConnection({...config,user:process.env.DB_ADMIN_USER??'root',password:process.env.DB_ADMIN_PASSWORD??''});
  appSql=await mysql.createConnection({...config,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
  await appSql.query("SET SESSION time_zone = '+00:00'");
  await admin.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
  await appSql.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
  const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');const address=socket.address();assert.ok(address&&typeof address==='object');port=address.port;await new Promise<void>(r=>socket.close(()=>r()));base=`http://127.0.0.1:${port}`;
  await start();
});
after(async()=>{await stop();await appSql?.end();await admin?.end();});

test('MariaDB 10.4.32 real, trece tablas, 40 estadísticas exactas y permisos mínimos',async()=>{
  assert.match((await rows('SELECT VERSION() v'))[0].v,/^10\.4\.32-MariaDB/);
  assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='truco_arena_dev' AND TABLE_TYPE='BASE TABLE'"),13);
  const catalog=(await request('/catalog')).data;
  const original=JSON.parse(await readFile(new URL('backend/src/demo/catalog.json',root),'utf8')).cards;
  assert.equal(catalog.mode,'persistent');assert.deepEqual([...catalog.cards].sort((a,b)=>a.id.localeCompare(b.id)),[...original].sort((a,b)=>a.id.localeCompare(b.id)));
  assert.equal((await request('/health')).data.database,'connected');
  await assert.rejects(appSql.query("INSERT INTO jugador(alias) VALUES('escritura-prohibida')"),/denied/i);
  await assert.rejects(appSql.query("INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(1,1,'00000000-0000-0000-0000-000000000000')"),/denied/i);
  await assert.rejects(appSql.query('DELETE FROM invocacion WHERE id_jugada=0'),/denied/i);
  await assert.rejects(appSql.query('CALL ta_validar_mazo(1,TRUE)'),/denied/i);
});

test('integridad referencial, CHECK de cantidades y zona/vida, clave única y ganador de la misma partida',async()=>{
  const f=await create();
  await admin.beginTransaction();
  try {
    await rejected('INSERT INTO mazo_carta(id_mazo,id_carta,cantidad) VALUES(4294967295,?,1)',['ESP-01'],/foreign key/i);
    await rejected('UPDATE mazo_carta SET cantidad=3 WHERE id_mazo=?',[f.decks[0].id],/CONSTRAINT/i);
    await rejected("UPDATE copia_carta_partida c JOIN participante_partida p ON p.id_participante=c.id_participante SET c.zona='CAMPO',c.vida_actual=NULL WHERE p.id_partida=?",[f.state.id],/CONSTRAINT/i);
    await rejected('INSERT INTO participante_partida(id_partida,posicion,id_mazo) VALUES(?,1,?)',[f.state.id,f.decks[0].id],/Duplicate/i);
    const [inserted]=await admin.query<mysql.ResultSetHeader>('INSERT INTO partida(version) VALUES(1)');
    await rejected("UPDATE partida SET fecha_fin=CURRENT_TIMESTAMP(6),motivo_cierre='LIMITE_TURNOS',ganador_posicion=1 WHERE id_partida=?",[inserted.insertId],/foreign key/i);
  } finally {await admin.rollback();}
});

test('guardar mazos: <=20, máximo dos, colección, propietario y rollback de edición inválida',async()=>{
  const f=await fixture();const own=f.players[0].id;const id=f.decks[0].id;
  for(const invalid of [[...entries20,{cardId:'BAS-01',quantity:1}],[{cardId:'ESP-01',quantity:3}],[{cardId:'NO-EX',quantity:1}]]) {
    assert.ok((await request('/decks',{ownerId:own,name:'Inválido',entries:invalid})).status>=400);
  }
  const wrong=await request(`/decks/${id}`,{ownerId:f.players[1].id,name:'Ajeno',entries},'PUT');assert.ok(wrong.status>=400);
  // Dato de prueba reducido por administrador, nunca por el rol de aplicación.
  await admin.execute('UPDATE coleccion_jugador SET cantidad=1 WHERE id_jugador=? AND id_carta=?',[own,'ESP-01']);
  const failed=await request(`/decks/${id}`,{ownerId:own,name:'Edición no válida',entries},'PUT');assert.ok(failed.status>=400);
  const saved=(await request(`/decks?ownerId=${own}`)).data.decks.find((d:any)=>d.id===id);assert.equal(saved.name,'Mazo test');assert.equal(saved.entries.reduce((n:number,e:any)=>n+e.quantity,0),12);
  await admin.execute('UPDATE coleccion_jugador SET cantidad=2 WHERE id_jugador=? AND id_carta=?',[own,'ESP-01']);
  const draft=await request('/decks',{ownerId:own,name:'Borrador',entries:entries.slice(0,5)});assert.equal(draft.status,201);
  assert.ok((await request('/duels',{...f.input,deckIds:[draft.data.id,f.decks[1].id]})).status>=400);
  assert.ok((await request('/duels',{...f.input,deckIds:[f.decks[1].id,id]})).status>=400);
  // Saltar toda validación HTTP: la frontera SQL también debe rechazarlo.
  for(const invalid of [[...entries20,{cardId:'BAS-01',quantity:1}],[{cardId:'ESP-01',quantity:3}],[entries[0],entries[0]]]) {
    const count=await scalar('SELECT COUNT(*) FROM mazo WHERE id_jugador=?',[own]);
    await appSql.beginTransaction();
    try {await assert.rejects(appSql.execute('CALL ta_guardar_mazo(?,?,?,?,?)',[own,null,'Inválido directo','',JSON.stringify(invalid)]));await appSql.commit();assert.equal(await scalar('SELECT COUNT(*) FROM mazo WHERE id_jugador=?',[own]),count);} finally {await appSql.rollback();}
  }
});

test('formato 20: cuarenta copias exactas, tamaños iguales, posiciones, idempotencia y rollback SQL',async()=>{
 const f=await fixture(),decks=[];
 for(const p of f.players){const saved=await request('/decks',{ownerId:p.id,name:'Mazo 20',entries:entries20});assert.equal(saved.status,201);decks.push(saved.data);}
 const mixedKey=randomUUID();const mixed=await request('/duels',{...f.input,requestId:mixedKey,deckIds:[decks[0].id,f.decks[1].id]});assert.equal(mixed.status,400);
 assert.equal(await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[mixedKey]),0);
 const input={...f.input,requestId:randomUUID(),deckIds:decks.map(d=>d.id)};
 const started=await request('/duels',input);assert.equal(started.status,201,JSON.stringify(started.data));
 assert.deepEqual(started.data.players.map((p:any)=>[p.hand.length,p.deckCount]),[[3,17],[3,17]]);
 const copies=await rows('SELECT c.*,p.id_mazo FROM copia_carta_partida c JOIN participante_partida p ON p.id_participante=c.id_participante WHERE p.id_partida=?',[started.data.id]);assert.equal(copies.length,40);
 for(const deck of decks){const own=copies.filter(c=>String(c.id_mazo)===deck.id);assert.equal(own.length,20);assert.deepEqual(own.map(c=>c.posicion_original).sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));for(const e of entries20)assert.equal(own.filter(c=>c.id_carta===e.cardId).length,e.quantity);}
 const replay=await request('/duels',input);assert.equal(replay.status,200);assert.equal(replay.data.id,started.data.id);assert.equal(replay.data.operation.replayed,true);
 await rejected('UPDATE copia_carta_partida SET posicion_original=21 WHERE id_copia=?',[copies[0].id_copia],/ck_copia_posicion/);
 await appSql.beginTransaction();
 try {await assert.rejects(appSql.execute('CALL ta_guardar_mazo(?,?,?,?,?)',[f.players[0].id,null,'No debe guardarse','',JSON.stringify([...entries20,{cardId:'BAS-01',quantity:1}])]),/MAZO_INVALIDO/);await appSql.commit();}
 finally{await appSql.rollback();}
 assert.equal(await scalar('SELECT COUNT(*) FROM mazo WHERE id_jugador=? AND nombre=?',[f.players[0].id,'No debe guardarse']),0);
});

test('inicio atómico: dos participantes, 24 copias exactas, 3+9, mazo usado inmutable',async()=>{
  const f=await create();
  assert.equal(await scalar('SELECT COUNT(*) FROM participante_partida WHERE id_partida=?',[f.state.id]),2);
  const copies=await rows('SELECT c.id_carta,c.posicion_original,c.zona,c.vida_actual,p.id_mazo FROM copia_carta_partida c JOIN participante_partida p ON p.id_participante=c.id_participante WHERE p.id_partida=?',[f.state.id]);assert.equal(copies.length,24);
  for(const deck of f.decks) { const subset=copies.filter(c=>String(c.id_mazo)===deck.id);assert.equal(subset.length,12);assert.equal(subset.filter(c=>c.zona==='MANO').length,3);assert.equal(subset.filter(c=>c.zona==='MAZO').length,9);assert.ok(subset.every(c=>c.vida_actual===null));assert.deepEqual(subset.map(c=>c.posicion_original).sort((a,b)=>a-b),Array.from({length:12},(_,i)=>i+1));for(const e of entries)assert.equal(subset.filter(c=>c.id_carta===e.cardId).length,e.quantity); }
  assert.equal(f.state.turn,1);assert.equal(f.state.version,1);assert.equal(f.state.mode,'persistent');
  assert.ok((await request(`/decks/${f.decks[0].id}`,{ownerId:f.players[0].id,name:'No permitido',entries},'PUT')).status>=400);
  assert.ok((await request('/duels',{...f.input,requestId:randomUUID()})).status>=400);
  const before=await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE id_partida=?',[f.state.id]);
  // La acción ahora existe: una copia inexistente se rechaza sin solicitud/eventos.
  const invalid=await request(`/duels/${f.state.id}/actions`,{expectedVersion:1,actorId:f.state.activePlayerId,requestId:randomUUID(),action:{type:'play',instanceId:'4294967295'}});assert.ok(invalid.status>=400&&invalid.status<500);
  assert.equal(await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE id_partida=?',[f.state.id]),before);
});

test('triggers de subtipos: exclusión en ambos sentidos e historial inmutable; admin aún puede crear padre sin hijo',async()=>{
  const f=await create();
  await admin.beginTransaction();
  try {
    const turn=(await rows('SELECT id_turno FROM turno WHERE id_partida=?',[f.state.id]))[0].id_turno;
    const copies=await rows('SELECT c.id_copia,p.id_participante FROM copia_carta_partida c JOIN participante_partida p ON p.id_participante=c.id_participante WHERE p.id_partida=? ORDER BY c.id_copia',[f.state.id]);
    const ids:number[]=[];
    for(let i=0;i<3;i++) {
      const key=randomUUID();await admin.execute("INSERT INTO solicitud_operacion(clave_reintento,id_partida,tipo_operacion,hash_parametros,version_resultante) VALUES(?,?,'INVOCAR',?,?)",[key,f.state.id,hash(i),i+2]);
      const [r]=await admin.execute<mysql.ResultSetHeader>('INSERT INTO jugada(id_turno,orden_en_turno,clave_reintento) VALUES(?,?,?)',[turn,i+1,key]);ids.push(r.insertId);
    }
    await admin.execute('INSERT INTO invocacion(id_jugada,id_copia) VALUES(?,?)',[ids[0],copies[0].id_copia]);
    await rejected('INSERT INTO ataque(id_jugada,id_copia_atacante,id_participante_objetivo,vida_previa_atacante,vida_previa_objetivo) VALUES(?,?,?,2,20)',[ids[0],copies[0].id_copia,copies[12].id_participante],/SUBTIPO_INVALIDO/);
    await admin.execute('INSERT INTO ataque(id_jugada,id_copia_atacante,id_participante_objetivo,vida_previa_atacante,vida_previa_objetivo) VALUES(?,?,?,2,20)',[ids[1],copies[1].id_copia,copies[12].id_participante]);
    await rejected('INSERT INTO invocacion(id_jugada,id_copia) VALUES(?,?)',[ids[1],copies[1].id_copia],/SUBTIPO_INVALIDO/);
    for(const table of ['jugada','invocacion','ataque']) await rejected(`UPDATE ${table} SET id_jugada=id_jugada WHERE id_jugada=?`,[table==='ataque'?ids[1]:ids[0]],/INMUTABLE/);
    assert.equal(await scalar('SELECT COUNT(*) FROM jugada j LEFT JOIN invocacion i ON i.id_jugada=j.id_jugada LEFT JOIN ataque a ON a.id_jugada=j.id_jugada WHERE j.id_jugada=? AND i.id_jugada IS NULL AND a.id_jugada IS NULL',[ids[2]]),1);
  } finally {await admin.rollback();}
});

test('replay secuencial y concurrente: misma clave, una sola partida; clave distinta/payload distinto se rechaza',async()=>{
  const f=await fixture();const before=await scalar('SELECT COUNT(*) FROM partida');
  const results=await Promise.all([request('/duels',f.input),request('/duels',f.input)]);
  assert.ok(results.every(r=>r.status===200||r.status===201),JSON.stringify(results));assert.equal(results[0].data.id,results[1].data.id);assert.equal(await scalar('SELECT COUNT(*) FROM partida'),before+1);
  const replay=await request('/duels',f.input);assert.equal(replay.data.id,results[0].data.id);assert.equal(replay.data.operation.replayed,true);
  assert.equal((await request('/duels',{...f.input,deckIds:[f.input.deckIds[1],f.input.deckIds[0]]})).status,409);
  const other=await fixture();assert.equal((await request('/duels',{...other.input,requestId:f.input.requestId})).status,409);
});

test('colisión concurrente global con jugadores diferentes revierte al perdedor',async()=>{
  const a=await fixture(),b=await fixture();const key=randomUUID();const before=await scalar('SELECT COUNT(*) FROM partida');
  const results=await Promise.all([request('/duels',{...a.input,requestId:key}),request('/duels',{...b.input,requestId:key})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await scalar('SELECT COUNT(*) FROM partida'),before+1);
  assert.equal(await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[key]),1);
});

test('snapshot coherente durante replay de inicio y cambio de turno concurrentes',async()=>{
  const f=await create();let state=f.state;
  for(let i=0;i<6;i++) {
    const [replay,next,read]=await Promise.all([
      request('/duels',f.input),
      request(`/duels/${state.id}/actions`,{expectedVersion:state.version,actorId:state.activePlayerId,requestId:randomUUID(),action:{type:'endTurn'}}),
      request(`/duels/${state.id}`),
    ]);
    assert.equal(next.status,200);assert.equal(replay.status,200);assert.equal(read.status,200);
    for(const r of [replay,next,read]) {assert.equal(r.data.version,r.data.turn);assert.equal(r.data.players.reduce((n:number,p:any)=>n+p.hand.length,0),6+Math.max(0,r.data.turn-2));}
    state=next.data;
  }
});

test('fallo después de escribir 24 copias: limpieza SAVEPOINT aun con COMMIT; reintento mismo UUID',async()=>{
  const f=await fixture();const key=f.input.requestId;const before=await scalar('SELECT COUNT(*) FROM partida');
  await admin.query(`CREATE TRIGGER ta_test_fail_receipt BEFORE INSERT ON solicitud_operacion FOR EACH ROW BEGIN IF NEW.clave_reintento='${key}' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='FALLO_PRUEBA'; END IF; END`);
  try {
    await appSql.beginTransaction();
    await assert.rejects(appSql.execute('CALL ta_iniciar_partida(?,?,?,?,?,?)',[key,hash(f.input),f.players[0].id,f.decks[0].id,f.players[1].id,f.decks[1].id]),/FALLO_PRUEBA/);
    await appSql.commit(); // La rutina ya deshizo todo incluso si el llamador omite rollback.
    assert.equal(await scalar('SELECT COUNT(*) FROM partida'),before);
    assert.equal(await scalar('SELECT COUNT(*) FROM solicitud_operacion WHERE clave_reintento=?',[key]),0);
  } finally {await appSql.rollback();await admin.query('DROP TRIGGER IF EXISTS ta_test_fail_receipt');}
  assert.equal((await request('/duels',f.input)).status,201);
});

test('composición incorrecta pese a sumar doce rechazada dentro de SQL; sin inicio parcial',async()=>{
  const f=await fixture();const before=await scalar('SELECT COUNT(*) FROM partida');
  await admin.query("CREATE TRIGGER ta_test_wrong_card BEFORE INSERT ON copia_carta_partida FOR EACH ROW BEGIN IF NEW.id_carta='ESP-02' THEN SET NEW.id_carta='ESP-01'; END IF; END");
  try {const r=await request('/duels',f.input);assert.ok(r.status>=400);assert.equal(await scalar('SELECT COUNT(*) FROM partida'),before);} finally {await admin.query('DROP TRIGGER IF EXISTS ta_test_wrong_card');}
});

test('turnos SQL: actor, versión, replay sin doble robo, energía, agotamiento y cierre exacto en 30',async()=>{
  const f=await create();let state=f.state;
  const action=(s:any)=>({expectedVersion:s.version,actorId:s.activePlayerId,requestId:randomUUID(),action:{type:'endTurn'}});
  const wrongActor=state.players.find((p:any)=>p.id!==state.activePlayerId).id;
  assert.equal((await request(`/duels/${state.id}/actions`,{...action(state),actorId:wrongActor})).status,403);
  const input=action(state);state=(await request(`/duels/${state.id}/actions`,input)).data;assert.equal(state.turn,2);assert.ok(state.players.every((p:any)=>p.hand.length===3));
  const replay=await request(`/duels/${state.id}/actions`,input);assert.equal(replay.data.turn,2);assert.equal(replay.data.operation.replayed,true);
  assert.equal((await request(`/duels/${state.id}/actions`,{...input,requestId:randomUUID()})).status,409);
  state=(await request(`/duels/${state.id}/actions`,action(state))).data;assert.equal(state.turn,3);assert.equal(state.players.find((p:any)=>p.id===state.activePlayerId).hand.length,4);
  while(state.status==='active') {
    const active=state.players.find((p:any)=>p.id===state.activePlayerId);assert.equal(active.energy,Math.min(5,Math.floor((state.turn+1)/2)));
    if(state.turn===29) assert.equal(state.status,'active');
    const r=await request(`/duels/${state.id}/actions`,action(state));assert.equal(r.status,200,JSON.stringify(r.data));state=r.data;
  }
  assert.equal(state.turn,30);assert.equal(state.winnerId,null);assert.ok(state.players.every((p:any)=>p.deckCount===0&&p.hand.length===12));
  assert.equal(await scalar('SELECT COUNT(*) FROM turno WHERE id_partida=?',[state.id]),30);assert.equal(await scalar('SELECT COUNT(*) FROM turno WHERE id_partida=? AND fecha_cierre IS NULL',[state.id]),0);
  assert.equal((await rows('SELECT motivo_cierre FROM partida WHERE id_partida=?',[state.id]))[0].motivo_cierre,'LIMITE_TURNOS');
  assert.equal((await request(`/duels/${state.id}/actions`,action(state))).status,409);
  const replayStart=await request('/duels',f.input);assert.equal(replayStart.data.id,state.id);assert.equal(replayStart.data.version,31);assert.equal(replayStart.data.operation.versionResult,1);
});

test('persistencia comprobada tras detener Node y arrancar un proceso nuevo',async()=>{
  const f=await create();await stop();await start();
  const decks=(await request(`/decks?ownerId=${f.players[0].id}`)).data.decks;assert.ok(decks.some((d:any)=>d.id===f.decks[0].id));
  const result=await request(`/duels/${f.state.id}`);assert.equal(result.status,200);assert.equal(result.data.id,f.state.id);assert.equal(result.data.version,1);assert.equal(result.data.players.reduce((n:number,p:any)=>n+p.hand.length+p.deckCount,0),24);
  assert.equal((await request(`/players/${f.players[0].id}/collection`)).data.cards.length,40);
  assert.ok((await request(`/players/${f.players[0].id}/duels`)).data.duels.some((d:any)=>d.id===f.state.id));
});
