import { createHash } from 'node:crypto';

const namespace = 'Academia TA v1';
const database = 'truco_arena_dev';
const deckPatterns = [
  ['ESP-02', 'ESP-04', 'ESP-05', 'BAS-04', 'ORO-05', 'COP-04'],
  ['BAS-02', 'BAS-04', 'BAS-05', 'ESP-04', 'ORO-04', 'COP-04'],
  ['ORO-02', 'ORO-04', 'ORO-05', 'ESP-05', 'COP-05', 'BAS-04'],
  ['COP-02', 'COP-04', 'COP-05', 'ESP-04', 'BAS-05', 'ORO-05'],
];
const sqlMode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION';
const operations = {
  ta_crear_jugador: 1, ta_guardar_mazo: 5, ta_iniciar_partida: 6,
  ta_finalizar_turno: 5, ta_invocar: 6, ta_atacar: 8,
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function uuid(label) {
  const value = digest([namespace, label]);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-5${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}
function required(condition, message) { if (!condition) throw new Error(`${namespace}: ${message}`); }
const sortedEntries = entries => entries.map(e => ({ cardId: e.cardId, quantity: Number(e.quantity) })).sort((a, b) => a.cardId.localeCompare(b.cardId));

/**
 * Reproducible academic fixture, independent from browser/Express and using the real SQL motor.
 * Connection must point to a local truco_arena_dev and have SELECT + EXECUTE of public routines.
 * No direct writes, deletion, life edits, fixed shuffled positions, or fabricated combat events.
 * Reserved aliases identify this fixture. Existing mismatching records are reported, not overwritten.
 * Returns a manifest; the caller decides where to record evidence.
 */
export async function seedAcademicFixtures(connection) {
  const host = connection.connection?.config?.host ?? connection.config?.host;
  required(host === undefined || ['127.0.0.1', 'localhost'].includes(host), 'solo conexiones locales.');
  const [[session]] = await connection.query('SELECT DATABASE() AS db, @@in_transaction AS active');
  required(session.db === database, `la conexión debe seleccionar ${database}.`);
  required(Number(session.active) === 0, 'el coordinador no debe tener una transacción abierta.');
  const [[lock]] = await connection.execute('SELECT GET_LOCK(?,10) AS acquired', [`${database}:academic-v1`]);
  required(Number(lock.acquired) === 1, 'otra carga académica está en ejecución.');
  let committedCommands = 0;

  const rows = async (sql, parameters = []) => (await connection.execute(sql, parameters))[0];
  async function transaction(work) {
    await connection.beginTransaction();
    try { const result = await work(); await connection.commit(); return result; }
    catch (error) { try { await connection.rollback(); } catch {} throw error; }
  }
  async function call(name, parameters) {
    required(operations[name] === parameters.length, 'firma de rutina desconocida.');
    const [sets] = await connection.execute(`CALL ${name}(${parameters.map(() => '?').join(',')})`, parameters);
    const row = sets.find(set => Array.isArray(set) && set.length)?.[0];
    required(row, `${name} no devolvió un recibo.`);
    if (!Number(row.replayed ?? 0)) committedCommands++;
    return row;
  }
  async function state(id, lockCurrent = false) {
    const [game] = await rows(`SELECT id_partida,version,fecha_fin,motivo_cierre,ganador_posicion FROM partida WHERE id_partida=?${lockCurrent ? ' FOR UPDATE' : ''}`, [id]);
    required(game, `no se encuentra la partida ${id}.`);
    const participants = await rows('SELECT pp.id_participante,pp.posicion,pp.vida_heroe,pp.id_mazo,m.id_jugador FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo WHERE pp.id_partida=? ORDER BY pp.posicion', [id]);
    const [turn] = await rows('SELECT id_turno,numero_global,energia_disponible,fecha_cierre FROM turno WHERE id_partida=? ORDER BY numero_global DESC LIMIT 1', [id]);
    required(participants.length === 2 && turn, `partida ${id} incompleta.`);
    const copies = await rows(`SELECT c.id_copia,c.id_participante,c.id_carta,c.zona,c.vida_actual,
      ca.ataque_base,ca.vida_base,ca.costo_energia,t.numero_global AS entered_turn,
      (SELECT MAX(ta.numero_global) FROM ataque a JOIN jugada ja ON ja.id_jugada=a.id_jugada JOIN turno ta ON ta.id_turno=ja.id_turno WHERE a.id_copia_atacante=c.id_copia) AS attacked_turn
      FROM copia_carta_partida c JOIN participante_partida pp ON pp.id_participante=c.id_participante
      JOIN carta ca ON ca.id_carta=c.id_carta LEFT JOIN invocacion i ON i.id_copia=c.id_copia
      LEFT JOIN jugada j ON j.id_jugada=i.id_jugada LEFT JOIN turno t ON t.id_turno=j.id_turno
      WHERE pp.id_partida=? ORDER BY c.id_copia`, [id]);
    const invocations = await rows('SELECT c.id_participante,COUNT(*) AS amount FROM invocacion i JOIN copia_carta_partida c ON c.id_copia=i.id_copia JOIN participante_partida pp ON pp.id_participante=c.id_participante WHERE pp.id_partida=? GROUP BY c.id_participante', [id]);
    const [[combats]] = await connection.execute('SELECT COUNT(*) AS amount FROM ataque a JOIN jugada j ON j.id_jugada=a.id_jugada JOIN turno t ON t.id_turno=j.id_turno WHERE t.id_partida=? AND a.id_copia_objetivo IS NOT NULL', [id]);
    const position = Number(turn.numero_global) % 2 ? 1 : 2;
    return { ...game, turn, participants, copies, invocations, combats: Number(combats.amount), actor: participants.find(p => Number(p.posicion) === position), rival: participants.find(p => Number(p.posicion) !== position) };
  }
  function choose(s, aggressor, kind) {
    if (s.fecha_fin !== null) return null;
    if (kind === 'active' && s.combats > 0) return null;
    const own = s.copies.filter(c => c.id_participante === s.actor.id_participante);
    const enemies = s.copies.filter(c => c.id_participante === s.rival.id_participante && c.zona === 'CAMPO');
    const invoked = Number(s.invocations.find(i => i.id_participante === s.actor.id_participante)?.amount ?? 0);
    const attackingPlayer = Number(s.actor.id_jugador) === Number(aggressor);
    // Both players have all twelve cards by their own tenth opening (global 19/20).
    if (Number(s.turn.numero_global) >= 19 && invoked < (attackingPlayer ? 3 : 1)) {
      const hand = own.filter(c => c.zona === 'MANO' && Number(c.costo_energia) <= Number(s.turn.energia_disponible));
      hand.sort((a, b) => Number(b.ataque_base) - Number(a.ataque_base) || Number(a.costo_energia) - Number(b.costo_energia) || a.id_carta.localeCompare(b.id_carta) || Number(a.id_copia) - Number(b.id_copia));
      // Defender's 2/3 and aggressor's 3/2 eliminate each other, including counter-damage.
      const candidate = attackingPlayer ? hand[0] : hand.find(c => Number(c.ataque_base) === 2 && Number(c.vida_base) === 3);
      if (candidate && own.filter(c => c.zona === 'CAMPO').length < 3) return { type: 'play', copy: Number(candidate.id_copia) };
    }
    if (attackingPlayer) {
      const ready = own.filter(c => c.zona === 'CAMPO' && Number(c.entered_turn) < Number(s.turn.numero_global) && Number(c.attacked_turn ?? 0) !== Number(s.turn.numero_global));
      ready.sort((a, b) => Number(b.ataque_base) - Number(a.ataque_base) || Number(a.id_copia) - Number(b.id_copia));
      if (ready.length && (enemies.length || kind === 'victory')) return { type: 'attack', copy: Number(ready[0].id_copia), targetCopy: enemies.length ? Number(enemies[0].id_copia) : null, targetHero: enemies.length ? null : Number(s.rival.id_participante) };
    }
    return { type: 'endTurn' };
  }

  try {
    await connection.query("SET SESSION time_zone='+00:00'");
    await connection.execute('SET SESSION sql_mode=?', [sqlMode]);
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.query('SET SESSION foreign_key_checks=1, check_constraint_checks=1');
    const [[catalog]] = await connection.query('SELECT COUNT(*) AS amount FROM carta');
    required(Number(catalog.amount) === 40, 'se requieren las cuarenta cartas originales.');
    const players = [], decks = [];
    for (let index = 0; index < 16; index++) {
      const number = String(index + 1).padStart(2, '0');
      const alias = `${namespace} Jugador ${number}`;
      let [player] = await rows('SELECT id_jugador,alias,fecha_archivo FROM jugador WHERE alias=?', [alias]);
      if (!player) {
        const receipt = await transaction(() => call('ta_crear_jugador', [alias]));
        [player] = await rows('SELECT id_jugador,alias,fecha_archivo FROM jugador WHERE id_jugador=?', [receipt.id_jugador]);
      }
      required(player.fecha_archivo === null, `el perfil reservado ${alias} fue archivado; no se altera.`);
      const collection = await rows('SELECT id_carta,cantidad FROM coleccion_jugador WHERE id_jugador=?', [player.id_jugador]);
      required(collection.length === 40 && collection.every(row => Number(row.cantidad) === 2), `colección reservada ${alias} no coincide; no se sobrescribe.`);
      players.push({ id: Number(player.id_jugador), alias });
      const name = `${namespace} Mazo ${number}`;
      const expected = sortedEntries(deckPatterns[index % 4].map(cardId => ({ cardId, quantity: 2 })));
      let [deck] = await rows('SELECT id_mazo,id_jugador,nombre,fecha_archivo FROM mazo WHERE id_jugador=? AND nombre=?', [player.id_jugador, name]);
      if (!deck) {
        const receipt = await transaction(() => call('ta_guardar_mazo', [player.id_jugador, null, name, 'Fixture académico reproducible v1; no editar.', JSON.stringify(expected)]));
        [deck] = await rows('SELECT id_mazo,id_jugador,nombre,fecha_archivo FROM mazo WHERE id_mazo=?', [receipt.id_mazo]);
      }
      const actual = await rows('SELECT id_carta AS cardId,cantidad AS quantity FROM mazo_carta WHERE id_mazo=?', [deck.id_mazo]);
      required(deck.fecha_archivo === null && JSON.stringify(sortedEntries(actual)) === JSON.stringify(expected), `el mazo reservado ${name} no coincide; no se modifica.`);
      decks.push({ id: Number(deck.id_mazo), ownerId: Number(player.id_jugador), name, entries: expected });
    }

    const plan = [];
    for (let pair = 0; pair < 6; pair++) {
      for (const [round, kind] of ['victory', 'victory', 'draw'].entries()) plan.push({ label: `pair-${pair + 1}:round-${round + 1}`, left: pair * 2, right: pair * 2 + 1, kind });
    }
    plan.push({ label: 'active-pair-7', left: 12, right: 13, kind: 'active' });
    const matches = [];
    for (const match of plan) {
      const left = players[match.left], right = players[match.right];
      const startKey = uuid(`match:${match.label}:create`);
      const startHash = digest({ protocol: 'academic-v1', operation: 'CREAR_PARTIDA', players: [left.id, right.id], decks: [decks[match.left].id, decks[match.right].id] });
      const receipt = await transaction(() => call('ta_iniciar_partida', [startKey, startHash, left.id, decks[match.left].id, right.id, decks[match.right].id]));
      const id = Number(receipt.id_partida);
      let completed;
      for (let step = 0; step < 100; step++) {
        const outcome = await transaction(async () => {
          const s = await state(id, true);
          const actualOwners = s.participants.map(p => Number(p.id_jugador)).sort((a, b) => a - b);
          required(JSON.stringify(actualOwners) === JSON.stringify([left.id, right.id].sort((a, b) => a - b)), `participantes inesperados en ${match.label}.`);
          const action = choose(s, left.id, match.kind);
          if (!action) return { done: true, state: s };
          const key = uuid(`match:${match.label}:version:${s.version}`);
          const hash = digest({ protocol: 'academic-v1', game: id, actor: Number(s.actor.id_jugador), version: Number(s.version), action });
          const common = [key, hash, id, Number(s.actor.id_jugador), Number(s.version)];
          if (action.type === 'play') await call('ta_invocar', [...common, action.copy]);
          else if (action.type === 'attack') await call('ta_atacar', [...common, action.copy, action.targetCopy, action.targetHero]);
          else await call('ta_finalizar_turno', common);
          return { done: false };
        });
        if (outcome.done) { completed = outcome.state; break; }
      }
      required(completed, `la secuencia acotada de ${match.label} no terminó.`);
      const actualWinner = completed.ganador_posicion === null ? null : Number(completed.participants.find(p => Number(p.posicion) === Number(completed.ganador_posicion)).id_jugador);
      if (match.kind === 'victory') required(completed.fecha_fin !== null && completed.motivo_cierre === 'VIDA_CERO' && actualWinner === left.id, `resultado inesperado en ${match.label}; no se altera.`);
      if (match.kind === 'draw') required(completed.fecha_fin !== null && completed.motivo_cierre === 'LIMITE_TURNOS' && actualWinner === null, `empate esperado en ${match.label}; no se altera.`);
      if (match.kind === 'active') required(completed.fecha_fin === null && completed.combats >= 1, 'la partida activa reservada fue finalizada externamente; no se reemplaza.');
      matches.push({ id, label: match.label, expected: match.kind, playerIds: [left.id, right.id], deckIds: [decks[match.left].id, decks[match.right].id], requestId: startKey, turn: Number(completed.turn.numero_global), version: Number(completed.version), status: completed.fecha_fin === null ? 'active' : 'finished', reason: completed.motivo_cierre, winnerId: actualWinner });
    }
    const matchIds = matches.map(m => m.id);
    const placeholders = matchIds.map(() => '?').join(',');
    const [counts] = await rows(`SELECT
      (SELECT COUNT(*) FROM participante_partida WHERE id_partida IN (${placeholders})) AS participants,
      (SELECT COUNT(*) FROM copia_carta_partida c JOIN participante_partida p ON p.id_participante=c.id_participante WHERE p.id_partida IN (${placeholders})) AS copies,
      (SELECT COUNT(*) FROM turno WHERE id_partida IN (${placeholders})) AS turns,
      (SELECT COUNT(*) FROM jugada j JOIN turno t ON t.id_turno=j.id_turno WHERE t.id_partida IN (${placeholders})) AS plays,
      (SELECT COUNT(*) FROM invocacion i JOIN jugada j ON j.id_jugada=i.id_jugada JOIN turno t ON t.id_turno=j.id_turno WHERE t.id_partida IN (${placeholders})) AS invocations,
      (SELECT COUNT(*) FROM ataque a JOIN jugada j ON j.id_jugada=a.id_jugada JOIN turno t ON t.id_turno=j.id_turno WHERE t.id_partida IN (${placeholders})) AS attacks`, Array.from({ length: 6 }, () => matchIds).flat());
    required(Number(counts.invocations) >= 15 && Number(counts.attacks) >= 15, 'faltan jugadas representativas.');
    return { namespace, players, decks, matches, activeMatch: matches.find(m => m.expected === 'active'), noMatchPlayers: players.slice(14), committedCommands, counts: { players: players.length, collectionEntries: players.length * 40, decks: decks.length, deckEntries: decks.length * 6, matches: matches.length, finishedMatches: matches.filter(m => m.status === 'finished').length, activeMatches: matches.filter(m => m.status === 'active').length, ...Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])) } };
  } finally {
    try { await connection.execute('SELECT RELEASE_LOCK(?)', [`${database}:academic-v1`]); } catch {}
  }
}
