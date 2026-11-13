// Package the existing MariaDB engine, not a reverse port of the Supabase services.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {statements} from './lib/sql-files.mjs';

const dir='database/mariadb/install',db='truco_online_xampp';
const names=['01-schema.sql','02-routines.sql','03-seed.sql','04-combat.sql','05-vistas.sql','08-deck-removal.sql','09-decks-20.sql','10-restart-game.sql'];
const files=new Map();for(const n of names)files.set(n,(await readFile('database/mariadb/'+n,'utf8')).replaceAll('\r\n','\n'));
const routines=new Map();
for(const [file,source] of files)for(const sql of statements(source)){
 const found=sql.match(/^CREATE (PROCEDURE|TRIGGER) (\w+)/);
 if(found)routines.set(found[1]+' '+found[2],{file,sql});
}
if(routines.size!==14)throw Error('Unexpected number of MariaDB procedures/triggers');
const replace=s=>s.replaceAll('truco_arena_dev',db);
let schema=replace(files.get('01-schema.sql')).replace(/CREATE DATABASE IF NOT EXISTS /,'CREATE DATABASE ').replaceAll('CREATE TABLE IF NOT EXISTS ','CREATE TABLE ');
schema=schema.replace('-- Only this isolated development database is targeted. No DROP DATABASE.','-- Base NUEVA de entrega XAMPP. CREATE DATABASE falla si ya existe; no usar --force.');
const header=`-- TRUCOONLINE PARA XAMPP / MariaDB 10.4.32 o posterior (NO PostgreSQL).
-- Generado: node scripts/build-xampp-install.mjs
-- Instalar UNA VEZ como administrador en una instancia LOCAL de MariaDB.
-- Crea la base NUEVA ${db}; no debe existir previamente.
-- Importar desde phpMyAdmin > Inicio del servidor > Importar, formato SQL, UTF-8.
-- Alternativa CMD: C:\\xampp\\mysql\\bin\\mysql.exe -u root -p --default-character-set=utf8mb4 < TrucoOnline-XAMPP.sql
-- No usar --force ni continuar despues de un error. No borra bases ni crea cuentas.
-- Incluye: 13 tablas academicas, 40 cartas originales, 4 jugadores FICTICIOS,
-- 8 mazos de ejemplo (4 de 12 y 4 de 20), motor SQL, triggers y vista de coleccion.
-- NO equivale a las 16 tablas y servicios operativos de Supabase.
-- No incluye Auth/JWT, recuperacion, salas online, Cron ni worker CPU autonomo.
-- Las rutinas requieren START TRANSACTION / COMMIT del coordinador.
-- MariaDB hace commit implicito de DDL: este instalador NO es una transaccion global.
-- Si falla, conservar el error y revisar la base parcial antes de volver a importar.
-- B1-B4 academicos pendientes. Sin datos de personas ni credenciales de produccion.

`;
const parts=[header,schema,'\n-- RUTINAS FINALES: se conservan los cuerpos vigentes, sin DROP/ALTER historicos.\nDELIMITER $$\n'];
for(const {file,sql} of routines.values())parts.push(`\n-- Fuente: ${file}\n${replace(sql)}$$\n`);
parts.push('\nDELIMITER ;\n\n-- CATALOGO ORIGINAL Y EJEMPLOS FICTICIOS\n',replace(files.get('03-seed.sql')),'\n',replace(files.get('05-vistas.sql')));
const {cards}=JSON.parse(await readFile('backend/src/demo/catalog.json','utf8'));
const quote=s=>"'"+s.replaceAll("'","''")+"'";
parts.push('\n-- Mazos de 20: misma composicion que scripts/lib/decks-20.mjs.\nSTART TRANSACTION;\n');
for(const [i,name] of ['Ana','Bruno','Carla','Diego'].entries()){
 const entries=cards.slice(i*10,i*10+10).map(c=>({cardId:c.id,quantity:2}));
 parts.push(`CALL ta_guardar_mazo((SELECT id_jugador FROM jugador WHERE alias=${quote(name+' demo SQL')}),NULL,${quote('Mazo 20 · '+name)},'Formato de 20 cartas para revision local.',${quote(JSON.stringify(entries))});\n`);
}
parts.push(`COMMIT;
SELECT 'INSTALACION_COMPLETA_XAMPP' AS resultado,VERSION() AS servidor,DATABASE() AS base,
 (SELECT COUNT(*) FROM carta) AS cartas,(SELECT COUNT(*) FROM jugador) AS jugadores_ficticios,
 (SELECT COUNT(*) FROM mazo) AS mazos_ejemplo;
`);
const sql=parts.join('');
if(/DROP (?:DATABASE|TABLE|PROCEDURE|TRIGGER)|\bauth\.users\b|CREATE USER|GRANT /i.test(sql))throw Error('Unexpected destructive/cloud/account statement');
const verify=`-- SOLO LECTURA. Ejecutar despues de importar TrucoOnline-XAMPP.sql.
USE ${db};
SELECT VERSION() AS servidor,DATABASE() AS base;
SELECT COUNT(*) AS tablas_esperadas_13 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE';
SELECT COUNT(*) AS relaciones_fk_esperadas_20 FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE();
SELECT COUNT(*) AS procedimientos_esperados_9 FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND ROUTINE_TYPE='PROCEDURE';
SELECT COUNT(*) AS triggers_esperados_5 FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE();
SELECT COUNT(*) AS cartas_esperadas_40 FROM carta;
SELECT palo,COUNT(*) AS cartas_por_palo FROM carta GROUP BY palo;
SELECT j.alias,m.nombre,SUM(mc.cantidad) AS cartas FROM mazo m JOIN jugador j USING(id_jugador) JOIN mazo_carta mc USING(id_mazo) GROUP BY j.alias,m.id_mazo,m.nombre ORDER BY j.alias,cartas;
SELECT COUNT(*) AS colecciones_esperadas_160 FROM v_coleccion_jugador;
SELECT COUNT(*) AS partidas_iniciales_0 FROM partida;
`;
const manifest={target:'XAMPP MariaDB; academic local engine; not Supabase feature parity',database:db,tables:13,cards:40,procedures:9,triggers:5,sourceFiles:[...files].map(([name,body])=>({file:'database/mariadb/'+name,sha256:createHash('sha256').update(body).digest('hex')})),transformations:['Distinct new database truco_online_xampp; fail when it exists','Final CREATE PROCEDURE/TRIGGER bodies selected by name; historical DROP and redundant ALTER not executed','Schema source already supports positions 1..20 and REINICIO; no rule changes','Original 40-card seed with four fictional players and 12-card decks','Four 20-card example decks reproduce scripts/lib/decks-20.mjs'],excluded:['06 academic example queries and 07 transaction demonstration do not run during installation','Supabase-specific Auth, recovery, online rooms, deadlines/Cron, CPU worker and recent CPU abandonment switching'],sqlSha256:createHash('sha256').update(sql).digest('hex')};
const outputs={'TrucoOnline-XAMPP.sql':sql,'Verificar-instalacion.sql':verify,'fuentes.json':JSON.stringify(manifest,null,2)+'\n'};
await mkdir(dir,{recursive:true});
for(const [file,body] of Object.entries(outputs)){
 if(process.argv.includes('--check')){if((await readFile(dir+'/'+file,'utf8'))!==body)throw Error('Regenerate '+file);}
 else await writeFile(dir+'/'+file,body);
}
console.log(JSON.stringify({database:db,bytes:Buffer.byteLength(sql),procedures:9,triggers:5,check:process.argv.includes('--check')}));
