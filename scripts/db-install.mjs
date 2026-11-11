import mysql from 'mysql2/promise';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { statements } from './lib/sql-files.mjs';
import { seedAcademicFixtures } from './lib/academic-fixtures.mjs';
import { seedTwentyDecks } from './lib/decks-20.mjs';

const root = new URL('../', import.meta.url);
const db = 'truco_arena_dev';
if (process.env.DB_NAME && process.env.DB_NAME !== db) throw new Error('Solo se permite truco_arena_dev.');
const envPath = process.env.DB_ENV_FILE ? resolve(process.env.DB_ENV_FILE) : fileURLToPath(new URL('backend/.env.mariadb', root));
const envRelative = relative(fileURLToPath(root),envPath);
if (isAbsolute(envRelative) || envRelative.startsWith('..') || !/(?:^|[\\/])\.env(?:[.\w-]*)$/.test(envRelative)) throw new Error('DB_ENV_FILE debe ser un archivo .env ignorado dentro del proyecto.');
let previous = '';
try { previous = await readFile(envPath, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
const password = previous.match(/^DB_PASSWORD=([a-f0-9]+)$/m)?.[1] ?? randomBytes(32).toString('hex');
const host = process.env.DB_HOST ?? '127.0.0.1';
const port = Number(process.env.DB_PORT ?? 3306);
if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('Instalación permitida solo en XAMPP local.');
const connection = await mysql.createConnection({ host, port, user: process.env.DB_ADMIN_USER ?? 'root', password: process.env.DB_ADMIN_PASSWORD ?? '', multipleStatements: false });

try {
  const [[version]] = await connection.query('SELECT VERSION() AS version');
  if (!version.version.includes('MariaDB')) throw new Error('Se requiere MariaDB.');
  const [users] = await connection.execute("SELECT Host FROM mysql.user WHERE User='truco_arena_app'");
  if (users.length && !previous) throw new Error('La cuenta truco_arena_app ya existe sin credencial local del proyecto; no se modifica.');
  for (const file of ['01-schema.sql', '02-routines.sql', '03-seed.sql', '04-combat.sql', '05-vistas.sql', '08-deck-removal.sql', '09-decks-20.sql', '10-restart-game.sql']) {
    const source = await readFile(new URL(`database/mariadb/${file}`, root), 'utf8');
    for (const statement of statements(source)) await connection.query(statement);
    console.log(`Aplicado ${file}`);
  }
  await seedTwentyDecks(connection);
  const expected = JSON.parse(await readFile(new URL('backend/src/demo/catalog.json',root),'utf8')).cards;
  const [actual] = await connection.query('SELECT id_carta id,nombre name,palo suit,numero number,ataque_base attack,vida_base health,costo_energia cost,jerarquia_truco hierarchy FROM carta ORDER BY id_carta');
  const sorted = expected.toSorted((a,b)=>a.id.localeCompare(b.id));
  if (JSON.stringify(actual) !== JSON.stringify(sorted)) throw new Error('Catálogo SQL distinto del original; no se sobrescribe. Revisar manualmente.');
  // Nunca cambiar contraseñas de cuentas preexistentes. Repetir usa la credencial local.
  if (!users.length) await connection.query("CREATE USER 'truco_arena_app'@'127.0.0.1' IDENTIFIED BY ?", [password]);
  await connection.query("GRANT SELECT ON truco_arena_dev.* TO 'truco_arena_app'@'127.0.0.1'");
  for (const routine of ['ta_crear_jugador', 'ta_guardar_mazo', 'ta_iniciar_partida', 'ta_finalizar_turno', 'ta_invocar', 'ta_atacar', 'ta_eliminar_mazo', 'ta_reiniciar_partida']) {
    await connection.query(`GRANT EXECUTE ON PROCEDURE truco_arena_dev.${routine} TO 'truco_arena_app'@'127.0.0.1'`);
  }
  const app = await mysql.createConnection({host, port, user:'truco_arena_app', password, database:db});
  try {
    const [[cards]] = await app.query('SELECT COUNT(*) AS total FROM carta');
    if (cards.total !== 40) throw new Error('El catálogo SQL no contiene 40 cartas.');
    const academic = await seedAcademicFixtures(app);
    console.log(`Datos académicos reproducibles: ${academic.players.length} jugadores, ${academic.decks.length} mazos, ${academic.matches.length} partidas.`);
  } finally { await app.end(); }
  await writeFile(envPath, `# Credencial local generada; ignorada por Git. B1-B4 pendientes.\nARENA_STORAGE=mariadb\nDB_HOST=${host}\nDB_PORT=${port}\nDB_NAME=${db}\nDB_USER=truco_arena_app\nDB_PASSWORD=${password}\n`, { mode:0o600 });
  console.log(`Instalación provisional lista: ${version.version}; solo ${db}. Credencial en backend/.env.mariadb (no se muestra).`);
} catch (error) {
  // mysql2 agrega error.sql; CREATE USER puede contener el secreto generado.
  const code = typeof error?.code === 'string' ? ` (${error.code})` : '';
  const safe = error?.sql === undefined && typeof error?.message === 'string' ? error.message : 'Revisar permisos y estado de instalación de truco_arena_dev.';
  console.error(`Instalación interrumpida${code}: ${safe}`);
  process.exitCode = 1;
} finally { await connection.end(); }
