import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {statements} from './lib/sql-files.mjs';
import {seedTwentyDecks} from './lib/decks-20.mjs';
const database='truco_arena_dev',host=process.env.DB_HOST??'127.0.0.1';
if(process.env.DB_NAME&&process.env.DB_NAME!==database)throw new Error('Solo se permite truco_arena_dev.');
if(!['127.0.0.1','localhost'].includes(host))throw new Error('Solo se permite XAMPP local.');
const db=await mysql.createConnection({host,port:Number(process.env.DB_PORT??3306),user:process.env.DB_ADMIN_USER??'root',password:process.env.DB_ADMIN_PASSWORD??'',database,multipleStatements:false});
async function historyHash(){
 const hash=createHash('sha256');
 for(const [table,key] of [['partida','id_partida'],['participante_partida','id_participante'],['copia_carta_partida','id_copia'],['turno','id_turno'],['jugada','id_jugada'],['invocacion','id_jugada'],['ataque','id_jugada'],['solicitud_operacion','clave_reintento']]){
  const [rows]=await db.query(`SELECT * FROM ${table} ORDER BY ${key}`);hash.update(JSON.stringify(rows));
 }
 return hash.digest('hex');
}
try{
 const [[version]]=await db.query('SELECT VERSION() version');if(!version.version.includes('MariaDB'))throw new Error('Se requiere MariaDB.');
 const before=await historyHash();
 for(const statement of statements(await readFile(new URL('../database/mariadb/09-decks-20.sql',import.meta.url),'utf8')))await db.query(statement);
 for(const routine of ['ta_guardar_mazo','ta_iniciar_partida'])await db.query(`GRANT EXECUTE ON PROCEDURE truco_arena_dev.${routine} TO 'truco_arena_app'@'127.0.0.1'`);
 const seeded=await seedTwentyDecks(db);
 if(before!==await historyHash())throw new Error('El historial cambió durante la actualización; revisar actividad concurrente.');
 console.log(`Formato 20 instalado en ${database} (${version.version}); ${seeded} mazos demo nuevos. Historial y copias de partidas existentes idénticos por SHA-256.`);
}finally{await db.end();}
