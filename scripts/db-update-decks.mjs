import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {statements} from './lib/sql-files.mjs';
const database='truco_arena_dev';
if(process.env.DB_NAME && process.env.DB_NAME!==database) throw new Error('Solo se permite truco_arena_dev.');
const host=process.env.DB_HOST??'127.0.0.1';
if(!['127.0.0.1','localhost'].includes(host)) throw new Error('Solo se permite XAMPP local.');
const connection=await mysql.createConnection({host,port:Number(process.env.DB_PORT??3306),user:process.env.DB_ADMIN_USER??'root',password:process.env.DB_ADMIN_PASSWORD??'',database,multipleStatements:false});
try {
 const [[version]]=await connection.query('SELECT VERSION() version');
 if(!version.version.includes('MariaDB')) throw new Error('Se requiere MariaDB.');
 const source=await readFile(new URL('../database/mariadb/08-deck-removal.sql',import.meta.url),'utf8');
 for(const sql of statements(source)) await connection.query(sql);
 await connection.query("GRANT EXECUTE ON PROCEDURE truco_arena_dev.ta_eliminar_mazo TO 'truco_arena_app'@'127.0.0.1'");
 console.log(`Actualizada eliminación de mazos en ${database}; ${version.version}. Sin cambios en otras bases.`);
} finally {await connection.end();}
