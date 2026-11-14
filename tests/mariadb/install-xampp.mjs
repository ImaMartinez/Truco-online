// Execute the deliverable with XAMPP's real client in a fresh, isolated server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir,copyFile,symlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import mysql from 'mysql2/promise';

const bin=resolve(process.env.XAMPP_MYSQL_BIN??'C:/xampp/mysql/bin');
const home=resolve('tmp/xampp-installer-'+randomUUID()),data=home+'/data';
await mkdir(home,{recursive:true});
const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));
function run(exe,args,input){return new Promise((done,reject)=>{const p=spawn(bin+'/'+exe,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.stdin.on('error',e=>{if(!['EPIPE','EOF'].includes(e.code))reject(e);});p.on('close',code=>done({code,out,err}));p.stdin.end(input);});}
const init=await run('mysql_install_db.exe',['--datadir='+data,'--port='+port,'--silent']);
assert.equal(init.code,0,'Isolated MariaDB initialization failed: '+init.err);
let server,c;const passed=[];const pass=s=>{passed.push(s);console.log('PASS '+s);};
async function start(){server=spawn(bin+'/mysqld.exe',['--no-defaults','--basedir='+resolve(bin,'..'),'--datadir='+data,'--port='+port,'--bind-address=127.0.0.1','--skip-log-bin','--max-connections=12','--log-error='+home+'/server.log','--pid-file='+home+'/server.pid'],{windowsHide:true,stdio:'ignore'});for(let i=0;i<100;i++){try{c=await mysql.createConnection({host:'127.0.0.1',port,user:'root',password:'',multipleStatements:false});return;}catch{if(server.exitCode!==null)throw Error('Isolated MariaDB stopped; inspect '+home+'/server.log');await delay(150);}}throw Error('Isolated MariaDB startup timeout');}
async function stop(){if(!server||server.exitCode!==null)return;const exited=once(server,'exit');try{await c.query('SHUTDOWN');}catch{}await c.end().catch(()=>{});await exited;}
const rows=async(sql,args=[])=>(await c.query(sql,args))[0];
const scalar=async(sql,args=[])=>Number(Object.values((await rows(sql,args))[0])[0]);
const hash=s=>createHash('sha256').update(s).digest('hex');
async function call(name,args){await c.beginTransaction();try{const [sets]=await c.query('CALL '+name+'('+args.map(()=>'?').join(',')+')',args);await c.commit();return sets[0]?.[0];}catch(e){await c.rollback();throw e;}}
async function state(id){return(await rows(`SELECT p.version,t.numero_global AS turn,t.energia_disponible AS energy,m.id_jugador AS actor,pp.id_participante AS participant FROM partida p JOIN turno t USING(id_partida) JOIN participante_partida pp ON pp.id_partida=p.id_partida AND pp.posicion=IF(MOD(t.numero_global,2)=1,1,2) JOIN mazo m USING(id_mazo) WHERE p.id_partida=? AND t.fecha_cierre IS NULL`,[id]))[0];}
async function end(id){const s=await state(id),key=randomUUID();return call('ta_finalizar_turno',[key,hash(key),id,s.actor,s.version]);}
const file=process.env.XAMPP_INSTALL_SQL??'database/mariadb/install/TrucoOnline-XAMPP.sql',source=await readFile(file,'utf8');
const clientArgs=['--no-defaults','--host=127.0.0.1','--port='+port,'--user=root','--batch','--default-character-set=utf8mb4'];
// Optional real phpMyAdmin UI regression, isolated from the installed config/data.
async function importInPhpMyAdmin(){
 const pma=resolve(process.env.XAMPP_PHPMYADMIN_DIR??'C:/xampp/phpMyAdmin'),php=resolve(process.env.XAMPP_PHP??'C:/xampp/php/php.exe'),web=home+'/phpmyadmin';
 await mkdir(web+'/libraries',{recursive:true});await mkdir(web+'/tmp',{recursive:true});await mkdir(home+'/sessions',{recursive:true});
 for(const dir of ['', '/libraries'])for(const entry of await readdir(pma+dir,{withFileTypes:true})){
  if(!dir&&['libraries','tmp','config.inc.php'].includes(entry.name))continue;
  const target=web+dir+'/'+entry.name;
  if(dir&&entry.name==='cache')await mkdir(target,{recursive:true});
  else if(entry.isDirectory())await symlink(pma+dir+'/'+entry.name,target,'junction');
  else await copyFile(pma+dir+'/'+entry.name,target);
 }
 await writeFile(web+'/config.inc.php',`<?php
$cfg['Servers'][1]=['auth_type'=>'config','host'=>'127.0.0.1','port'=>${port},'user'=>'root','password'=>'','AllowNoPassword'=>true];
$cfg['CheckConfigurationPermissions']=false;$cfg['VersionCheck']=false;$cfg['SendErrorReports']='never';
`);
 const listener=createServer().listen(0,'127.0.0.1');await once(listener,'listening');const webPort=listener.address().port;await new Promise(r=>listener.close(r));
 const base='http://127.0.0.1:'+webPort,p=spawn(php,['-d','session.save_path='+home+'/sessions','-S','127.0.0.1:'+webPort,'-t',web],{windowsHide:true,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await delay(100);}
  const {chromium}=await import('@playwright/test');
  const channel=existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'chrome':existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?'msedge':undefined;
  browser=await chromium.launch({channel});const page=await browser.newPage({viewport:{width:1366,height:900}});
  await mkdir('artifacts/xampp-install',{recursive:true});
  async function upload(sql,label,database){
   await page.goto(base+'/index.php?route='+ (database?'/database/import&db='+database:'/server/import'));const guiFile=home+'/'+label+'.sql';await writeFile(guiFile,sql);
   await page.locator('input[type=file][name=import_file]').setInputFiles(guiFile);
   await page.locator('#buttonGo').click();await page.waitForLoadState('networkidle');
   await page.screenshot({path:'artifacts/xampp-install/'+label+'.png',fullPage:true});
   const text=await page.locator('body').innerText();await writeFile('artifacts/xampp-install/'+label+'.txt',text);return text;
  }
  function successful(text){
   assert.doesNotMatch(text,/Commands out of sync|#\d{4}\s*-|Error: #\d+|Static analysis|Análisis estático/i);
   assert.match(text,/Importación ejecutada exitosamente|Import has been successfully finished|INSTALACION_COMPLETA_XAMPP/i);
  }
  successful(await upload(source.replaceAll('truco_online_xampp','truco_online_xampp_gui'),'phpmyadmin-import'));
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_gui.carta'),40);
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_gui.mazo'),8);
  assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='truco_online_xampp_gui'"),20);
  pass('Importacion real en phpMyAdmin 5.2.1/PHP 8.2 de XAMPP sin error 2014, con ocho mazos y 20 FK');
  // Recreate the previous installer mechanism, not a dependency on Downloads.
  const entries=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8')).cards.slice(0,10).map(c=>({cardId:c.id,quantity:2}));
  const legacy=(source.slice(0,source.indexOf('\n-- Mazos de 20:'))+`START TRANSACTION;
CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias='Ana demo SQL'),NULL,'Mazo 20 · Ana','Formato de 20 cartas para revision local.','${JSON.stringify(entries)}');
COMMIT;\n`).replaceAll('truco_online_xampp','truco_online_xampp_legacy');
  const broken=await upload(legacy,'phpmyadmin-original-error');assert.match(broken,/#2014 - Commands out of sync/);assert.match(broken,/SET FOREIGN_KEY_CHECKS = ON/);
  const before=await rows('SELECT * FROM truco_online_xampp_legacy.jugador ORDER BY id_jugador');
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_legacy.mazo'),4);
  const completion=(await readFile('database/mariadb/install/Completar-instalacion.sql','utf8')).replaceAll('truco_online_xampp','truco_online_xampp_legacy');
  successful(await upload(completion,'phpmyadmin-completion','truco_online_xampp_legacy'));
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_legacy.mazo'),8);
  assert.deepEqual(await rows('SELECT * FROM truco_online_xampp_legacy.jugador ORDER BY id_jugador'),before);
  successful(await upload(completion,'phpmyadmin-completion-retry','truco_online_xampp_legacy'));
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_legacy.mazo'),8);
  pass('Error 2014 original reproducido y base parcial recuperada por phpMyAdmin sin borrar ni duplicar datos');
  await c.query("INSERT INTO truco_online_xampp_legacy.jugador(alias) VALUES ('qa-no-es-instalacion-inicial')");
  const refused=await upload(completion,'phpmyadmin-completion-refused','truco_online_xampp_legacy');assert.match(refused,/La base no es una instalacion inicial de ejemplos/);
  assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_legacy.jugador'),5);assert.equal(await scalar('SELECT COUNT(*) FROM truco_online_xampp_legacy.mazo'),8);
  pass('Recuperacion rechaza base con usuarios adicionales; no reemplaza esquema ni modifica registros existentes');
 }finally{await browser?.close();if(p.exitCode===null){const exited=once(p,'exit');p.kill();await exited;}}
}
try{
 await start();const version=(await rows('SELECT VERSION() AS version'))[0].version;assert.match(version,/MariaDB/);
 if(process.argv.includes('--phpmyadmin'))await importInPhpMyAdmin();
 const imported=await run('mysql.exe',clientArgs,source);assert.equal(imported.code,0,imported.err);assert.match(imported.out,/INSTALACION_COMPLETA_XAMPP/);await c.query('USE truco_online_xampp');pass('Archivo unico importado con cliente real XAMPP/MariaDB, incluidos DELIMITER y rutinas');
 assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'"),13);assert.equal(await scalar('SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE()'),20);assert.equal(await scalar("SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND ROUTINE_TYPE='PROCEDURE'"),9);assert.equal(await scalar('SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()'),5);pass('13 tablas InnoDB, 20 FK, 9 procedimientos y 5 triggers');
 const expected=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8')).cards.toSorted((a,b)=>a.id.localeCompare(b.id));const actual=await rows('SELECT id_carta id,nombre name,palo suit,numero number,ataque_base attack,vida_base health,costo_energia cost,jerarquia_truco hierarchy FROM carta ORDER BY id_carta');assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);pass('40 cartas: nombres y todas las estadisticas originales exactas');
 assert.equal(await scalar('SELECT COUNT(*) FROM jugador'),4);assert.equal(await scalar('SELECT COUNT(*) FROM mazo'),8);assert.equal(await scalar('SELECT COUNT(*) FROM v_coleccion_jugador'),160);assert.deepEqual((await rows('SELECT SUM(cantidad) AS n FROM mazo_carta GROUP BY id_mazo ORDER BY n')).map(r=>Number(r.n)),[12,12,12,12,20,20,20,20]);assert.equal(await scalar('SELECT COUNT(*) FROM partida'),0);const verified=await run('mysql.exe',clientArgs,await readFile('database/mariadb/install/Verificar-instalacion.sql','utf8'));assert.equal(verified.code,0,verified.err);pass('Cuatro jugadores ficticios, ocho mazos 12/20, vista y consultas de revision');
 const duplicate=await run('mysql.exe',clientArgs,source);assert.notEqual(duplicate.code,0);assert.match(duplicate.err,/database exists/i);assert.equal(await scalar('SELECT COUNT(*) FROM jugador'),4);pass('Reimportacion rechazada al existir la base; no duplica datos ni reemplaza rutinas');
 const ids=[],decks=[],entries=['ESP-04','ESP-05','BAS-04','BAS-05','ORO-04','ORO-05'].map(cardId=>({cardId,quantity:2}));
 for(const alias of ['qa-xampp-1','qa-xampp-2']){const p=await call('ta_crear_jugador',[alias]);ids.push(p.id_jugador);const d=await call('ta_guardar_mazo',[p.id_jugador,null,'Mazo QA','Prueba aislada',JSON.stringify(entries)]);decks.push(d.id_mazo);}
 assert.equal(await scalar('SELECT COUNT(*) FROM coleccion_jugador WHERE id_jugador=?',[ids[0]]),40);await assert.rejects(call('ta_guardar_mazo',[ids[0],decks[1],'Ajeno','',JSON.stringify(entries)]));pass('Creacion de jugadores/colecciones/mazos y rechazo de modificacion de mazo ajeno');
 const key=randomUUID(),args=[key,hash(key),ids[0],decks[0],ids[1],decks[1]],g=await call('ta_iniciar_partida',args),id=g.id_partida;assert.ok(id);assert.equal(await scalar('SELECT COUNT(*) FROM copia_carta_partida c JOIN participante_partida pp USING(id_participante) WHERE pp.id_partida=?',[id]),24);assert.equal(await scalar("SELECT COUNT(*) FROM copia_carta_partida c JOIN participante_partida pp USING(id_participante) WHERE pp.id_partida=? AND c.zona='MANO'",[id]),6);const replay=await call('ta_iniciar_partida',args);assert.equal(Number(replay.replayed),1);assert.equal(replay.id_partida,id);pass('Partida de 12: 24 copias, tres cartas iniciales por participante y reintento sin duplicados');
 let s=await state(id);const card=(await rows("SELECT c.id_copia,t.ataque_base FROM copia_carta_partida c JOIN carta t USING(id_carta) WHERE c.id_participante=? AND c.zona='MANO' ORDER BY c.id_copia LIMIT 1",[s.participant]))[0];const playKey=randomUUID(),playArgs=[playKey,hash(playKey),id,s.actor,s.version,card.id_copia];await call('ta_invocar',playArgs);s=await state(id);assert.equal(s.energy,0);assert.equal(Number((await call('ta_invocar',playArgs)).replayed),1);const target=(await rows('SELECT id_participante,vida_heroe FROM participante_partida WHERE id_partida=? AND id_participante<>?',[id,s.participant]))[0];let attackKey=randomUUID();await assert.rejects(call('ta_atacar',[attackKey,hash(attackKey),id,s.actor,s.version,card.id_copia,null,target.id_participante]));assert.equal((await state(id)).version,s.version);pass('Invocacion, gasto de energia, idempotencia y rechazo de ataque antes del turno habilitado');
 await end(id);await end(id);s=await state(id);assert.equal(s.turn,3);assert.equal(s.energy,2);attackKey=randomUUID();await call('ta_atacar',[attackKey,hash(attackKey),id,s.actor,s.version,card.id_copia,null,target.id_participante]);assert.equal(await scalar('SELECT vida_heroe FROM participante_partida WHERE id_participante=?',[target.id_participante]),20-card.ataque_base);pass('Turnos alternados, energia progresiva y ataque al heroe con dano persistido');
 await c.beginTransaction();await c.query('CALL ta_crear_jugador(?)',['qa-xampp-rollback']);await c.rollback();assert.equal(await scalar("SELECT COUNT(*) FROM jugador WHERE alias='qa-xampp-rollback'"),0);pass('Rollback de DML revierte jugador y coleccion completos');
 const demos=await rows("SELECT m.id_mazo,m.id_jugador FROM mazo m JOIN jugador j USING(id_jugador) WHERE m.nombre IN ('Mazo 20 · Ana','Mazo 20 · Bruno') ORDER BY j.alias");const k20=randomUUID(),game20=await call('ta_iniciar_partida',[k20,hash(k20),demos[0].id_jugador,demos[0].id_mazo,demos[1].id_jugador,demos[1].id_mazo]);assert.equal(await scalar('SELECT COUNT(*) FROM copia_carta_partida c JOIN participante_partida pp USING(id_participante) WHERE pp.id_partida=?',[game20.id_partida]),40);pass('Partida de 20: 40 copias, sin alterar el formato clasico');
 const kr=randomUUID(),restarted=await call('ta_reiniciar_partida',[kr,hash(kr),ids[0],decks[0],ids[1],decks[1]]);assert.notEqual(restarted.id_partida,id);assert.equal((await rows('SELECT motivo_cierre FROM partida WHERE id_partida=?',[id]))[0].motivo_cierre,'REINICIO');assert.ok(await scalar('SELECT COUNT(*) FROM jugada j JOIN turno t USING(id_turno) WHERE t.id_partida=?',[id]));pass('Reinicio administrativo conserva partida e historial anteriores');
 await stop();await start();await c.query('USE truco_online_xampp');assert.equal(await scalar('SELECT COUNT(*) FROM carta'),40);assert.equal((await rows('SELECT motivo_cierre FROM partida WHERE id_partida=?',[id]))[0].motivo_cierre,'REINICIO');pass('Persistencia recuperada despues de apagar y reiniciar el servidor aislado');
 const result={date:new Date().toISOString(),file,sha256:hash(source),server:version,passed:passed.length,tests:passed,isolated:true,existingDatabasesTouched:false,cloudWrites:false,limitations:[...(process.argv.includes('--phpmyadmin')?[]:['phpMyAdmin UI not run; pass --phpmyadmin to test it']),'No Supabase Auth/online/Cron/worker parity','No global transactional DDL rollback in MariaDB']};await mkdir('artifacts/xampp-install',{recursive:true});await writeFile('artifacts/xampp-install/results.json',JSON.stringify(result,null,2)+'\n');
}finally{await stop();}
