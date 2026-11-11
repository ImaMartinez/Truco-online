import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sourcePath = 'docs/etapa-0/02-cartas-y-equilibrio.md';
const sourceUrl = new URL(`../${sourcePath}`, import.meta.url);
const outputUrl = new URL('../backend/src/demo/catalog.json', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const suits = { Espadas: 'espadas', Bastos: 'bastos', Oros: 'oros', Copas: 'copas' };
const validNumbers = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const cards = source.split(/\r?\n/).filter(line => /^\| (ESP|BAS|ORO|COP)-\d{2} \|/.test(line)).map(line => {
  const [id, name, suit, ...numbers] = line.split('|').slice(1, -1).map(cell => cell.trim());
  const [number, attack, health, cost, hierarchy] = numbers.map(Number);
  if (!suits[suit] || !validNumbers.includes(number) || ![attack, health, cost, hierarchy].every(Number.isInteger)
      || attack < 1 || health < 1 || cost < 1 || cost > 5 || hierarchy < 1 || hierarchy > 14) {
    throw new Error(`Fila de catálogo inválida: ${id}`);
  }
  return { id, name, suit: suits[suit], number, attack, health, cost, hierarchy };
});
if (cards.length !== 40 || new Set(cards.map(card => card.id)).size !== 40
    || new Set(cards.map(card => `${card.suit}:${card.number}`)).size !== 40) {
  throw new Error('La fuente debe contener exactamente las 40 cartas únicas.');
}
for (const suit of Object.values(suits)) {
  if (cards.filter(card => card.suit === suit).length !== 10) throw new Error(`Palo incompleto: ${suit}`);
}
const result = `${JSON.stringify({
  source: { path: sourcePath, sha256: createHash('sha256').update(source).digest('hex'), catalogVersion: '0.1' },
  cards,
}, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = await readFile(outputUrl, 'utf8');
  if (current !== result) throw new Error('El catálogo estructurado difiere de la documentación. Ejecutar npm run catalog:extract.');
  console.log('Catálogo verificado: 40 cartas idénticas a la fuente documental.');
} else {
  await mkdir(new URL('../backend/src/demo/', import.meta.url), { recursive: true });
  await writeFile(outputUrl, result, 'utf8');
  console.log(`Extraídas 40 cartas en ${fileURLToPath(outputUrl)}. Fuente académica preservada.`);
}
