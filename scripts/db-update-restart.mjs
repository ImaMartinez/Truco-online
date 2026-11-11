import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {statements} from './lib/sql-files.mjs';
const database='truco_arena_dev',host=process.env.DB_HOST??'127.0.0.1';
if(process.env.DB_NAME&&process.env.DB_NAME!==database)throw new Error('Solo se permite truco_arena_dev.');
if(!['127.0.0.1','localhost'].includes(host))throw new Error('Solo se permite XAMPP local.');
const db=await mysql.createConnection({host,port:Number(process.env.DB_PORT??3306),user:process.env.DB_ADMIN_USER??'root',password:process.env.DB_ADMIN_PASSWORD??'',database,multipleStatements:false});
try{
 const [[version]]=await db.query('SELECT VERSION() version');if(!version.version.includes('MariaDB'))throw new Error('Se requiere MariaDB.');
 for(const sql of statements(await readFile(new URL('../database/mariadb/10-restart-game.sql',import.meta.url),'utf8')))await db.query(sql);
 await db.query("GRANT EXECUTE ON PROCEDURE truco_arena_dev.ta_reiniciar_partida TO 'truco_arena_app'@'127.0.0.1'");
 console.log(`Reinicio atómico instalado en ${database}; ${version.version}. No se cerró ninguna partida.`);
}finally{await db.end();}
