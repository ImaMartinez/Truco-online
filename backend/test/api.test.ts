import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, unlink, rmdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createApp } from '../src/app.js';
import type { ApiErrorResponse, Card, CatalogResponse, Deck, DuelState, DuelAction } from '../../shared/contracts.js';

let server: Server;
let base: string;
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function request(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() as any };
}

test('deleting a demo deck removes it and preserves an already created match',async()=>{
 const entries=['ESP-01','ESP-02','ESP-03','ESP-04','ESP-05','ESP-06'].map(cardId=>({cardId,quantity:2}));
 const created=await request('/decks',{name:'Descartable API',entries});assert.equal(created.status,201);
 const duel=await request('/duels',{scenario:'inicio',deckIds:[created.data.id,created.data.id]});assert.equal(duel.status,201);
 const deleted=await request(`/decks/${created.data.id}`,undefined,'DELETE');assert.equal(deleted.status,200);
 assert.ok(!(await request('/decks')).data.decks.some((d:Deck)=>d.id===created.data.id));
 assert.equal((await request(`/duels/${duel.data.id}`)).status,200);
 assert.equal((await request(`/decks/${created.data.id}`,undefined,'DELETE')).status,404);
});
async function duel(scenario: 'inicio' | 'mesa-abierta' = 'mesa-abierta') {
  const result = await request('/duels', { scenario });
  assert.equal(result.status, 201);
  return result.data as DuelState;
}
async function act(state: DuelState, action: DuelAction) {
  return request(`/duels/${state.id}/actions`, { expectedVersion: state.version, action });
}

test('health is public, truthful and contains no environment or SQL credentials', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.data, { status: 'ok', service: 'truco-arena-api', mode: 'demo', storage: 'memory', database: 'not-connected', agreements: 'pending' });
});

test('catalog returns 40 exact documented cards, no 8 or 9, with source hash', async () => {
  const result = await request('/catalog');
  const catalog = result.data as CatalogResponse;
  assert.equal(result.status, 200);
  assert.equal(catalog.cards.length, 40);
  assert.equal(new Set(catalog.cards.map(card => card.id)).size, 40);
  assert.equal(new Set(catalog.cards.map(card => `${card.suit}:${card.number}`)).size, 40);
  assert.ok(catalog.cards.every(card => ![8, 9].includes(card.number)));
  assert.deepEqual(catalog.cards.find(card => card.id === 'ESP-01'), { id: 'ESP-01', name: 'Ancho de espadas', suit: 'espadas', number: 1, attack: 6, health: 5, cost: 5, hierarchy: 1 });
  const documented = await readFile(new URL('../../docs/etapa-0/02-cartas-y-equilibrio.md', import.meta.url), 'utf8');
  const extracted = JSON.parse(await readFile(new URL('../src/demo/catalog.json', import.meta.url), 'utf8'));
  assert.equal(extracted.source.sha256, createHash('sha256').update(documented).digest('hex'));
  assert.deepEqual(catalog.cards, extracted.cards);
});

test('deck editor saves and updates in-memory decks; invalid save does not mutate it', async () => {
  const initial = await request('/decks');
  const template: Deck = initial.data.decks[0];
  const created = await request('/decks', { name: 'Mazo de prueba', description: 'Solo memoria', entries: template.entries });
  assert.equal(created.status, 201);
  const saved: Deck = created.data;
  const invalid = await request(`/decks/${saved.id}`, { ...saved, entries: [{ cardId: 'ESP-04', quantity: 3 }] }, 'PUT');
  assert.equal(invalid.status, 400);
  const current = await request('/decks');
  assert.deepEqual(current.data.decks.find((deck: Deck) => deck.id === saved.id), saved);
  const changed = await request(`/decks/${saved.id}`, { name: 'Nombre editado', entries: [] }, 'PUT');
  assert.equal(changed.status, 200);
  assert.equal(changed.data.name, 'Nombre editado');
  assert.equal(changed.data.entries.length, 0);
  const start = await request('/duels', { deckIds: [saved.id, template.id] });
  assert.equal(start.status, 400, 'incomplete deck cannot start a duel');
});

test('deck validation rejects unknown cards, duplicates, totals over twenty and empty names', async () => {
  for (const body of [
    { name: 'Prueba', entries: [{ cardId: 'NO-EXISTE', quantity: 1 }] },
    { name: 'Prueba', entries: [{ cardId: 'ESP-04', quantity: 1 }, { cardId: 'ESP-04', quantity: 1 }] },
    { name: '', entries: [] },
    { name: 'Prueba', entries: ['ESP-01', 'ESP-02', 'ESP-03', 'ESP-04', 'ESP-05', 'ESP-06', 'ESP-07', 'ESP-10', 'ESP-11', 'ESP-12', 'BAS-01'].map(cardId => ({ cardId, quantity: 2 })) },
  ]) assert.equal((await request('/decks', body)).status, 400);
});

test('fresh duel has two heroes, distinct instances and correct opening/second turn draws', async () => {
  let state = await duel('inicio');
  assert.equal(state.turn, 1);
  assert.deepEqual(state.players.map(player => [player.life, player.hand.length, player.deckCount]), [[20, 3, 9], [20, 3, 9]]);
  assert.equal(state.players[0].energy, 1);
  const ids = state.players.flatMap(player => player.hand.map(instance => instance.id));
  assert.equal(new Set(ids).size, 6);
  state = (await act(state, { type: 'endTurn' })).data;
  assert.equal(state.turn, 2);
  assert.equal(state.players[1].hand.length, 3);
  assert.equal(state.players[1].energy, 1);
  state = (await act(state, { type: 'endTurn' })).data;
  assert.equal(state.turn, 3);
  assert.equal(state.players[0].hand.length, 4);
  assert.equal(state.players[0].deckCount, 8);
  assert.equal(state.players[0].energy, 2);
});

test('invocation spends energy, moves a specific instance and new cards cannot attack', async () => {
  let state = await duel();
  const before = state.players[0];
  const instance = before.hand[0]!;
  const response = await act(state, { type: 'play', instanceId: instance.id });
  assert.equal(response.status, 200);
  state = response.data;
  assert.equal(state.players[0].energy, before.energy - 1);
  assert.equal(state.players[0].hand.length, before.hand.length - 1);
  assert.ok(state.players[0].field.some(card => card.id === instance.id));
  const rejected = await act(state, { type: 'attack', attackerId: instance.id, targetId: state.players[1].field[0]!.id });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.data.error.code, 'CARTA_NUEVA');
  assert.deepEqual((await request(`/duels/${state.id}`)).data, state);
});

test('hero protection rejects without mutation; card damage is simultaneous with two discards', async () => {
  let state = await duel();
  const attacker = state.players[0].field[0]!;
  const target = state.players[1].field[0]!;
  const protectedHero = await act(state, { type: 'attack', attackerId: attacker.id, targetId: 'hero' });
  assert.equal(protectedHero.status, 409);
  assert.equal(protectedHero.data.error.code, 'HEROE_PROTEGIDO');
  assert.deepEqual((await request(`/duels/${state.id}`)).data, state);
  const attack = await act(state, { type: 'attack', attackerId: attacker.id, targetId: target.id });
  assert.equal(attack.status, 200);
  state = attack.data;
  assert.deepEqual(state.players.map(player => [player.field.length, player.discardCount]), [[0, 1], [0, 1]]);
  assert.equal(state.version, 2);
});

test('two concurrent commands with one version apply only once', async () => {
  const state = await duel();
  const action = { type: 'play', instanceId: state.players[0].hand[0]!.id } as const;
  const responses = await Promise.all([act(state, action), act(state, action)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const current: DuelState = (await request(`/duels/${state.id}`)).data;
  assert.equal(current.version, 2);
  assert.equal(current.players[0].field.length, 2);
});

const durableDeck = { name: 'Cartas de prueba', entries: ['BAS-02', 'BAS-07', 'COP-02', 'COP-06', 'COP-10', 'ESP-06'].map(cardId => ({ cardId, quantity: 2 })) };

test('insufficient energy and a fourth field card reject without changing the state', async () => {
  const deck: Deck = (await request('/decks', durableDeck)).data;
  let state: DuelState = (await request('/duels', { scenario: 'inicio', deckIds: [deck.id, 'ronda-copas'] })).data;
  const energyError = await act(state, { type: 'play', instanceId: state.players[0].hand[0]!.id });
  assert.equal(energyError.data.error.code, 'ENERGIA_INSUFICIENTE');
  assert.deepEqual((await request(`/duels/${state.id}`)).data, state);
  state = await duel();
  state = (await act(state, { type: 'play', instanceId: state.players[0].hand[0]!.id })).data;
  state = (await act(state, { type: 'play', instanceId: state.players[0].hand[0]!.id })).data;
  assert.equal(state.players[0].field.length, 3);
  const fullError = await act(state, { type: 'play', instanceId: state.players[0].hand[0]!.id });
  assert.equal(fullError.data.error.code, 'CAMPO_LLENO');
  assert.deepEqual((await request(`/duels/${state.id}`)).data, state);
});

test('surviving attackers cannot attack a second time in the same turn', async () => {
  const deck: Deck = (await request('/decks', durableDeck)).data;
  let state: DuelState = (await request('/duels', { scenario: 'mesa-abierta', deckIds: [deck.id, 'ronda-copas'] })).data;
  const attackerId = state.players[0].field[0]!.id;
  state = (await act(state, { type: 'attack', attackerId, targetId: state.players[1].field[0]!.id })).data;
  assert.equal(state.players[0].field[0]!.health, 1);
  const rejected = await act(state, { type: 'attack', attackerId, targetId: 'hero' });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.data.error.code, 'CARTA_AGOTADA');
  assert.deepEqual((await request(`/duels/${state.id}`)).data, state);
});

test('hero damage reaches an immediate victory before the turn limit', async () => {
  let state = await duel();
  state = (await act(state, { type: 'attack', attackerId: state.players[0].field[0]!.id, targetId: state.players[1].field[0]!.id })).data;
  for (const cardId of ['ESP-05', 'ESP-02']) {
    const card = state.players[0].hand.find(instance => instance.cardId === cardId)!;
    const result = await act(state, { type: 'play', instanceId: card.id });
    assert.equal(result.status, 200);
    state = result.data;
  }
  while (state.status === 'active' && state.turn <= 30) {
    if (state.activePlayerId === state.players[0].id) {
      for (const attacker of state.players[0].field) {
        if (attacker.enteredTurn < state.turn && attacker.lastAttackTurn !== state.turn) {
          const previousTurn = state.turn;
          const response = await act(state, { type: 'attack', attackerId: attacker.id, targetId: 'hero' });
          assert.equal(response.status, 200);
          state = response.data;
          if (state.status === 'finished') { assert.equal(state.turn, previousTurn); break; }
        }
      }
    }
    if (state.status === 'active') state = (await act(state, { type: 'endTurn' })).data;
  }
  assert.equal(state.status, 'finished');
  assert.equal(state.winnerId, state.players[0].id);
  assert.equal(state.players[1].life, 0);
  assert.ok(state.turn < 30);
  assert.equal((await act(state, { type: 'endTurn' })).status, 409);
});

test('full 30-turn simulation reaches a tie, exhausts decks and rejects further commands', async () => {
  let state = await duel('inicio');
  for (let count = 0; count < 30; count++) {
    const response = await act(state, { type: 'endTurn' });
    assert.equal(response.status, 200);
    state = response.data;
  }
  assert.equal(state.turn, 30);
  assert.equal(state.status, 'finished');
  assert.equal(state.winnerId, null);
  assert.deepEqual(state.players.map(player => [player.life, player.hand.length, player.deckCount]), [[20, 12, 0], [20, 12, 0]]);
  assert.equal((await act(state, { type: 'endTurn' })).status, 409);
});

test('malformed input, missing routes and oversized JSON return safe errors', async () => {
  for (const path of ['/not-a-route', '/duels/missing']) assert.equal((await request(path)).status, 404);
  const state = await duel();
  const unknown = await request(`/duels/${state.id}/actions`, { expectedVersion: 1, action: { type: 'invented' } });
  assert.equal(unknown.status, 400);
  const broken = await fetch(`${base}/api/decks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(broken.status, 400);
  const brokenJson = await broken.json() as ApiErrorResponse;
  assert.equal(brokenJson.error.code, 'JSON_INVALIDO');
  assert.ok(!JSON.stringify(brokenJson).includes('stack'));
  const huge = await fetch(`${base}/api/decks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x'.repeat(20000) }) });
  assert.equal(huge.status, 413);
});

test('server reads optional .env port without a dotenv dependency', async () => {
  const probe = createServer().listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const address = probe.address(); assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const directory = await mkdtemp(join(tmpdir(), 'truco-demo-config-'));
  await writeFile(join(directory, '.env'), `PORT=${port}\n`);
  const env = { ...process.env }; delete env.PORT;
  const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('../src/server.ts', import.meta.url))], { cwd: directory, env, windowsHide: true, stdio: 'pipe' });
  let started = false;
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) { started = true; break; }
      } catch { /* Child may still be starting. */ }
      await delay(100);
    }
    assert.ok(started, 'server must honor PORT from the optional .env');
  } finally {
    const exited = once(child, 'exit'); child.kill(); await exited;
    await unlink(join(directory, '.env')); await rmdir(directory);
  }
});
