import mysql from 'mysql2/promise';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {statements} from './lib/sql-files.mjs';
import {seedAcademicFixtures} from './lib/academic-fixtures.mjs';
import assert from 'node:assert/strict';
const root=process.cwd(), bin=process.env.MYSQL_BIN_DIR??'C:/xampp/mysql/bin';
const folder=await mkdtemp(resolve(root,'tmp/academic-mariadb-'));
async function freePort(){const s=createServer().listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
async function run(file,args,env=process.env){const p=spawn(file,args,{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);const [code]=await once(p,'exit');if(code)throw new Error(`Proceso falló (${code}): ${output}`);return output;}
const port=await freePort();assert.notEqual(port,3306);
await run(resolve(bin,'mysql_install_db.exe'),[`--datadir=${folder}`,`--port=${port}`]);
const server=spawn(resolve(bin,'mysqld.exe'),['--no-defaults',`--basedir=${resolve(bin,'..')}`,`--datadir=${folder}`,`--port=${port}`,'--bind-address=127.0.0.1','--console'],{windowsHide:true,stdio:'ignore'});
let db;
try{
 for(let i=0;i<100;i++){try{db=await mysql.createConnection({host:'127.0.0.1',port,user:'root'});break;}catch{await delay(100);}}
 assert.ok(db,'Servidor aislado no inició');
 const [[version]]=await db.query('SELECT VERSION() version');assert.match(version.version,/10\.4\.32-MariaDB/);
 const [empty]=await db.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='truco_arena_dev'");assert.equal(empty.length,0);
 const envFile=resolve(folder,'.env.mariadb');
 await run(process.execPath,['scripts/db-install.mjs'],{...process.env,DB_HOST:'127.0.0.1',DB_PORT:String(port),DB_ADMIN_USER:'root',DB_ADMIN_PASSWORD:'',DB_NAME:'truco_arena_dev',DB_ENV_FILE:envFile});
 await db.query('USE truco_arena_dev');
 const fixture=await seedAcademicFixtures(db);assert.equal(fixture.committedCommands,0);
 const snapshot=async()=>{const result={};for(const table of ['jugador','carta','coleccion_jugador','mazo','mazo_carta','partida','participante_partida','copia_carta_partida','turno','solicitud_operacion','jugada','invocacion','ataque']){const [[r]]=await db.query(`SELECT COUNT(*) n FROM ${table}`);result[table]=r.n;}return result;};
 const counts=await snapshot();await seedAcademicFixtures(db);assert.deepEqual(await snapshot(),counts);
 const source=await readFile('database/mariadb/06-consultas-academicas.sql','utf8');
 const queries=[];await db.execute('SET @jugador_id=?',[fixture.players[0].id]);
 for(const match of source.matchAll(/-- (Q\d{2}):([^\n]+)\n([\s\S]*?)(?=\n-- Q\d{2}:|$)/g)){const sql=statements(match[3])[0];const [rows]=await db.query(sql);queries.push({id:match[1],title:match[2].trim(),sql,rows});}
 assert.equal(queries.length,10);assert.equal(queries[0].rows.length,6);assert.ok(queries[4].rows.length>0);assert.equal(queries[8].rows.length,4);
 const [[view]]=await db.query('SELECT COUNT(*) filas FROM v_coleccion_jugador');assert.equal(view.filas,800);
 // Real invocation followed by a full outer rollback, through the existing routine.
 const p=fixture.activeMatch.id;
 const state=async()=>{const [r]=await db.query('SELECT p.version,t.energia_disponible,c.id_copia,c.zona,c.vida_actual FROM partida p JOIN turno t ON t.id_partida=p.id_partida AND t.fecha_cierre IS NULL JOIN participante_partida pp ON pp.id_partida=p.id_partida AND pp.posicion=IF(MOD(t.numero_global,2)=1,1,2) JOIN copia_carta_partida c ON c.id_participante=pp.id_participante WHERE p.id_partida=? ORDER BY c.id_copia',[p]);return r;};
 const before=await state();const [choices]=await db.query("SELECT c.id_copia,m.id_jugador FROM copia_carta_partida c JOIN participante_partida pp ON pp.id_participante=c.id_participante JOIN mazo m ON m.id_mazo=pp.id_mazo JOIN turno t ON t.id_partida=pp.id_partida AND t.fecha_cierre IS NULL WHERE pp.id_partida=? AND pp.posicion=IF(MOD(t.numero_global,2)=1,1,2) AND c.zona='MANO' LIMIT 1",[p]);
 const copy=choices[0];const key=crypto.randomUUID();await db.beginTransaction();await db.execute('CALL ta_invocar(?,?,?,?,?,?)',[key,'a'.repeat(64),p,copy.id_jugador,before[0].version,copy.id_copia]);const during=await state();assert.notDeepEqual(during,before);
 let controlledError;try{await db.query("SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ERROR_CONTROLADO_DESPUES_DE_INVOCAR'");}catch(e){controlledError=e.sqlMessage;}await db.rollback();const after=await state();assert.deepEqual(after,before);
 await db.beginTransaction();await db.execute('CALL ta_invocar(?,?,?,?,?,?)',[key,'a'.repeat(64),p,copy.id_jugador,before[0].version,copy.id_copia]);await db.commit();const committed=await state();assert.deepEqual(committed,during);
 const evidence={date:new Date().toISOString(),version:version.version,isolatedPort:port,dataDirectory:folder,cleanInstall:true,seedIdempotent:true,counts,fixture:fixture.counts,view:{name:'v_coleccion_jugador',rows:view.filas,endpoint:'/api/players/:id/collection'},transaction:{match:p,copy:copy.id_copia,before,during,controlledError,after,committed,rollbackVerified:true,commitVerified:true},queries};
 await writeFile('docs/hito-3/evidencia-ejecucion.json',JSON.stringify(evidence,null,2));
 const table=rows=>{if(!rows.length)return 'Sin filas.\n';const cols=Object.keys(rows[0]);const cell=v=>String(v??'NULL').replaceAll('|','\\|');return '| '+cols.join(' | ')+' |\n|'+cols.map(()=> '---').join('|')+'|\n'+rows.map(r=>'| '+cols.map(c=>cell(r[c])).join(' | ')+' |').join('\n')+'\n';};
 let md=`# Evidencia real de ejecución\n\n${evidence.date}. MariaDB ${version.version}; instancia temporal propia en puerto ${port}, sin modificar otras bases de XAMPP. Instalación desde ausencia de truco_arena_dev; carga y recarga idempotente comprobadas. B1–B4 y 3FN pendientes de revisión humana.\n\n## Datos iniciales\n\n${table(Object.entries(counts).map(([tabla,filas])=>({tabla,filas})))}\nVista v_coleccion_jugador: ${view.filas} filas. La pantalla Colección usa /api/players/:id/collection y el repositorio consulta esta vista.\n\n## Transacción y rollback\n\nPartida de fixture ${p}, copia ${copy.id_copia}. Se ejecutó BEGIN → CALL ta_invocar → SIGNAL controlado después de la invocación → ROLLBACK. El CALL terminó correctamente y se observaron sus cambios dentro de la transacción; el estado posterior al rollback coincide exactamente con el anterior. Esta prueba muestra el rollback externo sobre una operación real, además de la limpieza local SAVEPOINT que ya poseen las rutinas.\n\nAntes:\n\n${table(before)}\nDentro de la transacción:\n\n${table(during)}\nDespués del ROLLBACK:\n\n${table(after)}\nError controlado: ${controlledError}.\n\n## Diez consultas\n\n@jugador_id=${fixture.players[0].id} (${fixture.players[0].alias}). Resultados completos de la instancia limpia; IDs/fechas/sorteos pueden variar en otra instalación. Código y explicaciones en [consultas](02-consultas-academicas.md).\n\n`;
 md+='\nLa misma invocación fue repetida después con BEGIN/CALL/COMMIT: el estado confirmado coincide con el observado dentro de la transacción exitosa. Los conteos y consultas anteriores corresponden a la carga inicial, antes de esta demostración.\n\nEstado confirmado:\n\n'+table(committed)+'\n';
 for(const q of queries)md+=`<a id="${q.id.toLowerCase()}"></a>\n\n### ${q.id} — ${q.title}\n\n${q.rows.length} filas.\n\n${table(q.rows)}\n`;
 md+='## Reproducción\n\nDesde la raíz: `npm run build --workspace backend` y `npm run db:audit`. El proceso usa los binarios XAMPP en C:/xampp/mysql/bin (configurable con MYSQL_BIN_DIR), crea su propio datadir ignorado en tmp, no registra servicios y detiene su servidor al finalizar. Conserva el datadir para inspección; no contiene credenciales de producción. Detalles completos y snapshots en evidencia-ejecucion.json.\n';
 await writeFile('docs/hito-3/03-evidencia-ejecucion.md',md);
 console.log(JSON.stringify({version:version.version,cleanInstall:true,counts,queries:queries.map(q=>({id:q.id,rows:q.rows.length})),rollback:true}));
}finally{if(db){try{await db.query('SHUTDOWN');}catch{}db.destroy();}if(server.exitCode===null){await Promise.race([once(server,'exit'),delay(5000)]);if(server.exitCode===null)server.kill();}}
