import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const { cards } = JSON.parse(await readFile(new URL('backend/src/demo/catalog.json', root), 'utf8'));
const q = value => `'${String(value).replaceAll("'", "''")}'`;
let sql = `-- Generado desde catalog.json; no modifica estadísticas existentes. B1-B4 pendientes.\nUSE truco_arena_dev;\nSET NAMES utf8mb4 COLLATE utf8mb4_bin;\nSTART TRANSACTION;\nINSERT IGNORE INTO carta(id_carta,nombre,palo,numero,ataque_base,vida_base,costo_energia,jerarquia_truco) VALUES\n`;
sql += cards.map(c=>`(${[c.id,c.name,c.suit].map(q).join(',')},${[c.number,c.attack,c.health,c.cost,c.hierarchy].join(',')})`).join(',\n')+';\n';
// Resolver por alias, no asumir IDs libres ni sobrescribir registros/historia.
for (const [index, alias] of ['Ana demo SQL','Bruno demo SQL','Carla demo SQL','Diego demo SQL'].entries()) {
  const name = `Mazo inicial ${index+1}`;
  sql += `INSERT IGNORE INTO jugador(alias) VALUES(${q(alias)});\n`;
  sql += `INSERT IGNORE INTO coleccion_jugador(id_jugador,id_carta,cantidad) SELECT j.id_jugador,c.id_carta,2 FROM jugador j CROSS JOIN carta c WHERE j.alias=${q(alias)};\n`;
  sql += `INSERT IGNORE INTO mazo(id_jugador,nombre,descripcion) SELECT id_jugador,${q(name)},'Datos iniciales de desarrollo' FROM jugador WHERE alias=${q(alias)};\n`;
  for (const c of cards.slice(index*6,index*6+6)) {
    sql += `INSERT IGNORE INTO mazo_carta(id_mazo,id_carta,cantidad) SELECT m.id_mazo,${q(c.id)},2 FROM mazo m JOIN jugador j ON j.id_jugador=m.id_jugador WHERE j.alias=${q(alias)} AND m.nombre=${q(name)} AND NOT EXISTS(SELECT 1 FROM participante_partida p WHERE p.id_mazo=m.id_mazo);\n`;
  }
}
sql += 'COMMIT;\n';
const path = new URL('database/mariadb/03-seed.sql', root);
if (process.argv.includes('--check')) {
  if (await readFile(path,'utf8') !== sql) throw new Error('03-seed.sql difiere del catálogo original.');
  console.log('Seed SQL: 40 cartas originales verificadas.');
} else { await writeFile(path, sql); console.log('03-seed.sql generado.'); }
