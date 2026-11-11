/** Provisional MariaDB adapter: the SQL routines own all implemented game mutations. */
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createPool, type Pool, type PoolConnection, type PoolOptions, type RowDataPacket } from 'mysql2/promise';
import type { ActionRequest, ActiveDuel, Card, CardInstance, CollectionCard, CreateDuelRequest, Deck, DeckInput, DemoPlayer, DuelHistoryEvent, DuelState, HealthResponse, Player } from '../../../shared/contracts.js';
import type { ArenaRepository } from './arena-repository.js';
import { ApiError, invalid } from '../errors.js';

type Row = RowDataPacket & Record<string, any>;
type Receipt = { id_partida: number; version_resultante: number; replayed: number };
const sqlMode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION';

export function persistentId(value: unknown, label: string): number {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) invalid(`${label} debe ser un identificador válido.`);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 4294967295) invalid(`${label} debe ser un identificador válido.`);
  return id;
}
function requestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    invalid('La persistencia requiere requestId UUID canónico; reutilizalo al reintentar.');
  }
  return value;
}
export function operationHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function card(row: Row): Card {
  return { id: row.id_carta, name: row.nombre, suit: row.palo, number: Number(row.numero), attack: Number(row.ataque_base), health: Number(row.vida_base), cost: Number(row.costo_energia), hierarchy: Number(row.jerarquia_truco) };
}

export function translateMariaDbError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const db = error as { errno?: number; code?: string; sqlState?: string; sqlMessage?: string };
  if (db.sqlState === '45000') {
    const match = /^([A-Z_]+):\s*(.+)$/s.exec(db.sqlMessage ?? '');
    const code = match?.[1] ?? 'REGLA_SQL';
    const message = match?.[2] ?? 'La base rechazó la operación.';
    const status = /NO_ENCONTRAD/.test(code) ? 404 : /AJEN[OA]/.test(code) ? 403
      : /ACTIVA|UTILIZADO|DESACTUALIZADO|REUTILIZADA|FINALIZADA|TURNO_INVALIDO|CAMPO_LLENO|ENERGIA_INSUFICIENTE|CARTA_NUEVA|CARTA_AGOTADA|HEROE_PROTEGIDO|COPIA_YA_INVOCADA|COPIA_NO_EN_MANO|ATACANTE_INVALIDO|OBJETIVO_INVALIDO/.test(code) ? 409 : 400;
    return new ApiError(status, code, message);
  }
  if (db.errno === 1062) return new ApiError(409, 'VALOR_DUPLICADO', 'Ya existe un registro con esos datos únicos.');
  if (db.errno === 1451 || db.errno === 1452) return new ApiError(400, 'REFERENCIA_INVALIDA', 'La operación referencia un dato inexistente o utilizado.');
  if (db.errno === 4025 || db.errno === 1048 || db.errno === 1406) return new ApiError(400, 'DATO_INVALIDO', 'Un dato no cumple las restricciones de la base.');
  if (db.errno === 1213 || db.errno === 1205) return new ApiError(409, 'CONCURRENCIA_SQL', 'Otra operación está modificando esos datos. Reintentá con la misma clave.');
  return new ApiError(503, 'BASE_NO_DISPONIBLE', 'No pudimos completar la consulta MariaDB. Verificá XAMPP y la configuración del backend.');
}

export class MariaDbRepository implements ArenaRepository {
  readonly storage = 'mariadb' as const;
  readonly source = 'MariaDB truco_arena_dev · implementación provisional, B1–B4 pendientes';
  private readonly pool: Pool;

  constructor(options: PoolOptions) {
    if (options.database !== 'truco_arena_dev') throw new Error('El repositorio solo puede abrir truco_arena_dev.');
    this.pool = createPool({ ...options, multipleStatements: false });
  }
  async close(): Promise<void> { await this.pool.end(); }

  private async connection(): Promise<PoolConnection> {
    const connection = await this.pool.getConnection();
    try {
      await connection.execute("SET SESSION time_zone = '+00:00'");
      await connection.execute('SET SESSION sql_mode = ?', [sqlMode]);
      await connection.execute('SET SESSION foreign_key_checks = 1, check_constraint_checks = 1');
      return connection;
    } catch (error) { connection.release(); throw error; }
  }

  private async read<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
    let connection: PoolConnection | undefined;
    try { connection = await this.connection(); return await fn(connection); }
    catch (error) { throw translateMariaDbError(error); }
    finally { connection?.release(); }
  }

  private async transaction<T>(fn: (connection: PoolConnection) => Promise<T>, replayKey?: string, consistentRead = false): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let connection: PoolConnection | undefined;
      try {
        connection = await this.connection();
        await connection.execute(consistentRead ? 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ' : 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
      } catch (error) {
        if (connection) { try { await connection.rollback(); } catch { /* Original failure retained. */ } }
        const db = error as { errno?: number; sqlMessage?: string };
        let receiptCollision = false;
        if (replayKey && db.errno === 1062 && connection) {
          // Retry only if the client's key actually has a committed receipt after rollback.
          try { receiptCollision = (await this.rows(connection, 'SELECT clave_reintento FROM solicitud_operacion WHERE clave_reintento=?', [replayKey])).length === 1; }
          catch { /* Keep the original error if the connection cannot verify a receipt. */ }
        }
        if (attempt < 2 && (db.errno === 1213 || db.errno === 1205 || receiptCollision)) {
          await delay(20 * (attempt + 1));
          continue;
        }
        throw translateMariaDbError(error);
      } finally { connection?.release(); }
    }
  }

  private async rows(connection: PoolConnection, sql: string, values: any[] = []): Promise<Row[]> {
    const [rows] = await connection.execute<Row[]>(sql, values);
    return rows;
  }
  private async call(connection: PoolConnection, sql: string, values: any[]): Promise<Row> {
    const [sets] = await connection.execute(sql, values);
    const first = (sets as unknown as Row[][]).find(set => Array.isArray(set) && set.length > 0);
    if (!first?.[0]) throw new Error('La rutina no devolvió un resultado.');
    return first[0];
  }

  async health(): Promise<HealthResponse> {
    const healthy = await this.read(async connection => {
      const result = await this.rows(connection, 'SELECT DATABASE() AS db, 1 AS alive');
      return result[0]?.db === 'truco_arena_dev';
    }).catch(() => false);
    return { status: healthy ? 'ok' : 'degraded', service: 'truco-arena-api', mode: 'persistent', storage: 'mariadb', database: healthy ? 'connected' : 'unavailable', agreements: 'pending' };
  }
  async listCards(): Promise<Card[]> { return this.read(async c => (await this.rows(c, 'SELECT * FROM carta ORDER BY id_carta')).map(card)); }
  async listPlayers(): Promise<Player[]> {
    return this.read(async c => (await this.rows(c, 'SELECT id_jugador,alias FROM jugador WHERE fecha_archivo IS NULL ORDER BY id_jugador')).map(r => ({ id: String(r.id_jugador), alias: r.alias })));
  }
  async createPlayer(alias: string): Promise<Player> {
    return this.transaction(async c => {
      const result = await this.call(c, 'CALL ta_crear_jugador(?)', [alias]);
      const rows = await this.rows(c, 'SELECT id_jugador,alias FROM jugador WHERE id_jugador=?', [result.id_jugador]);
      return { id: String(rows[0]!.id_jugador), alias: rows[0]!.alias };
    });
  }
  async collection(playerId: string): Promise<CollectionCard[]> {
    const id = persistentId(playerId, 'El jugador');
    return this.read(async c => {
      if (!(await this.rows(c, 'SELECT id_jugador FROM jugador WHERE id_jugador=? AND fecha_archivo IS NULL', [id])).length) throw new ApiError(404, 'JUGADOR_NO_ENCONTRADO', 'Ese jugador no está disponible.');
      return (await this.rows(c, 'SELECT * FROM v_coleccion_jugador WHERE id_jugador=? ORDER BY id_carta', [id])).map(r => ({ ...card(r), quantity: Number(r.cantidad) }));
    });
  }
  private async decks(c: PoolConnection, ownerId?: number, deckId?: number): Promise<Deck[]> {
    const where = deckId !== undefined ? 'm.id_mazo=?' : ownerId !== undefined ? 'm.id_jugador=? AND m.fecha_archivo IS NULL' : 'm.fecha_archivo IS NULL';
    const values = deckId !== undefined ? [deckId] : ownerId !== undefined ? [ownerId] : [];
    const rows = await this.rows(c, `SELECT m.id_mazo,m.id_jugador,m.nombre,m.descripcion,EXISTS(SELECT 1 FROM participante_partida pp WHERE pp.id_mazo=m.id_mazo) AS usado,mc.id_carta,mc.cantidad FROM mazo m LEFT JOIN mazo_carta mc ON mc.id_mazo=m.id_mazo WHERE ${where} ORDER BY m.id_mazo,mc.id_carta`, values);
    const decks = new Map<number, Deck>();
    for (const row of rows) {
      if (!decks.has(row.id_mazo)) decks.set(row.id_mazo, { id: String(row.id_mazo), ownerId: String(row.id_jugador), name: row.nombre, description: row.descripcion, used: Boolean(row.usado), entries: [] });
      if (row.id_carta) decks.get(row.id_mazo)!.entries.push({ cardId: row.id_carta, quantity: Number(row.cantidad) });
    }
    return [...decks.values()];
  }
  async listDecks(ownerId?: string): Promise<Deck[]> { return this.read(c => this.decks(c, ownerId === undefined ? undefined : persistentId(ownerId, 'El dueño'))); }
  async deleteDeck(id: string, ownerId?: string): Promise<void> {
    const deckId = persistentId(id, 'El mazo'), owner = persistentId(ownerId, 'El dueño');
    await this.transaction(async c => { await this.call(c, 'CALL ta_eliminar_mazo(?,?)', [owner, deckId]); });
  }
  async saveDeck(input: DeckInput, id?: string): Promise<Deck> {
    const owner = persistentId(input.ownerId, 'El dueño');
    const deckId = id === undefined ? null : persistentId(id, 'El mazo');
    return this.transaction(async c => {
      const result = await this.call(c, 'CALL ta_guardar_mazo(?,?,?,?,?)', [owner, deckId, input.name, input.description ?? '', JSON.stringify(input.entries)]);
      return (await this.decks(c, undefined, Number(result.id_mazo)))[0]!;
    });
  }
  async createDuel(input: CreateDuelRequest): Promise<DuelState> {
    if (input.scenario && input.scenario !== 'inicio') invalid('La mesa preparada está disponible solo en memory; MariaDB inicia partidas reglamentarias.');
    if (!input.playerIds || !input.deckIds) invalid('Elegí dos jugadores y un mazo propio de cada uno.');
    const player1 = persistentId(input.playerIds[0], 'El jugador 1'), player2 = persistentId(input.playerIds[1], 'El jugador 2');
    const deck1 = persistentId(input.deckIds[0], 'El mazo 1'), deck2 = persistentId(input.deckIds[1], 'El mazo 2');
    const key = requestKey(input.requestId);
    const hash = operationHash({ protocol: 1, operation: 'CREAR_PARTIDA', player1, deck1, player2, deck2, ...(input.replaceActive ? {replaceActive:true} : {}) });
    return this.transaction(async c => {
      const receipt = await this.call(c, input.replaceActive ? 'CALL ta_reiniciar_partida(?,?,?,?,?,?)' : 'CALL ta_iniciar_partida(?,?,?,?,?,?)', [key, hash, player1, deck1, player2, deck2]) as Receipt;
      const state = await this.snapshot(c, Number(receipt.id_partida), true);
      return { ...state, operation: { requestId: key, replayed: Boolean(receipt.replayed), versionResult: Number(receipt.version_resultante) } };
    }, key);
  }
  async getDuel(id: string): Promise<DuelState> { return this.transaction(c => this.snapshot(c, persistentId(id, 'La partida')), undefined, true); }
  async act(id: string, request: ActionRequest): Promise<DuelState> {
    const game = persistentId(id, 'La partida'), actor = persistentId(request.actorId, 'El actor');
    const key = requestKey(request.requestId);
    const action = request.action;
    const version = request.expectedVersion;
    const instance = action.type === 'play' ? persistentId(action.instanceId, 'La copia')
      : action.type === 'attack' ? persistentId(action.attackerId, 'El atacante') : undefined;
    const target = action.type === 'attack' && action.targetId !== 'hero' ? persistentId(action.targetId, 'El objetivo') : null;
    const operation = action.type === 'play' ? 'INVOCAR' : action.type === 'attack' ? 'ATACAR' : 'FINALIZAR_TURNO';
    const hash = operationHash({ protocol: 1, operation, game, actor, version,
      ...(action.type === 'play' ? { copy: instance } : action.type === 'attack' ? { attacker: instance, target: action.targetId === 'hero' ? 'hero' : target } : {}),
    });
    return this.transaction(async c => {
      let receipt: Receipt;
      if (action.type === 'play') {
        receipt = await this.call(c, 'CALL ta_invocar(?,?,?,?,?,?)', [key, hash, game, actor, version, instance]) as Receipt;
      } else if (action.type === 'attack') {
        let hero: number | null = null;
        if (action.targetId === 'hero') {
          // The client names the rival hero, never a participant ID or calculated damage.
          // Used-deck ownership and participant membership are immutable through app routines.
          const rivals = await this.rows(c, 'SELECT rival.id_participante FROM participante_partida propio JOIN mazo m ON m.id_mazo=propio.id_mazo JOIN participante_partida rival ON rival.id_partida=propio.id_partida AND rival.id_participante<>propio.id_participante WHERE propio.id_partida=? AND m.id_jugador=?', [game, actor]);
          if (rivals.length !== 1) {
            if (!(await this.rows(c, 'SELECT id_partida FROM partida WHERE id_partida=?', [game])).length) throw new ApiError(404, 'PARTIDA_NO_ENCONTRADA', 'La partida solicitada no existe.');
            throw new ApiError(403, 'TURNO_AJENO', 'El actor no pertenece a esta partida.');
          }
          hero = Number(rivals[0]!.id_participante);
        }
        receipt = await this.call(c, 'CALL ta_atacar(?,?,?,?,?,?,?,?)', [key, hash, game, actor, version, instance, target, hero]) as Receipt;
      } else {
        receipt = await this.call(c, 'CALL ta_finalizar_turno(?,?,?,?,?)', [key, hash, game, actor, version]) as Receipt;
      }
      const state = await this.snapshot(c, game, true);
      return { ...state, operation: { requestId: key, replayed: Boolean(receipt.replayed), versionResult: Number(receipt.version_resultante) } };
    }, key);
  }
  async activeDuels(playerId: string): Promise<ActiveDuel[]> {
    const id = persistentId(playerId, 'El jugador');
    return this.read(async c => (await this.rows(c, 'SELECT p.id_partida,p.version,p.fecha_inicio,MAX(t.numero_global) AS turno FROM partida p JOIN participante_partida pp ON pp.id_partida=p.id_partida JOIN mazo m ON m.id_mazo=pp.id_mazo JOIN turno t ON t.id_partida=p.id_partida WHERE m.id_jugador=? AND p.fecha_fin IS NULL GROUP BY p.id_partida,p.version,p.fecha_inicio ORDER BY p.id_partida DESC', [id])).map(r => ({ id: String(r.id_partida), version: Number(r.version), turn: Number(r.turno), startedAt: String(r.fecha_inicio) })));
  }

  private async snapshot(c: PoolConnection, id: number, lockCurrent = false): Promise<DuelState> {
    // RC command/replay transactions hold the game row while projecting all its child rows.
    // Read-only GET uses a repeatable-read snapshot instead. Both avoid mixed versions.
    const lock = lockCurrent ? ' LOCK IN SHARE MODE' : '';
    const games = await this.rows(c, `SELECT id_partida,fecha_fin,motivo_cierre,ganador_posicion,version FROM partida WHERE id_partida=?${lock}`, [id]);
    if (!games[0]) throw new ApiError(404, 'PARTIDA_NO_ENCONTRADA', 'La partida solicitada no existe.');
    const game = games[0];
    const participants = await this.rows(c, 'SELECT pp.id_participante,pp.posicion,pp.vida_heroe,m.id_jugador,j.alias FROM participante_partida pp JOIN mazo m ON m.id_mazo=pp.id_mazo JOIN jugador j ON j.id_jugador=m.id_jugador WHERE pp.id_partida=? ORDER BY pp.posicion', [id]);
    const turns = await this.rows(c, 'SELECT id_turno,numero_global,energia_disponible,fecha_cierre FROM turno WHERE id_partida=? ORDER BY numero_global', [id]);
    const instances = await this.rows(c, 'SELECT cc.id_copia,cc.id_participante,cc.id_carta,cc.zona,cc.vida_actual,ca.vida_base,ti.numero_global AS invocado,MAX(ta.numero_global) AS ultimo_ataque FROM copia_carta_partida cc JOIN participante_partida pp ON pp.id_participante=cc.id_participante JOIN carta ca ON ca.id_carta=cc.id_carta LEFT JOIN invocacion i ON i.id_copia=cc.id_copia LEFT JOIN jugada ji ON ji.id_jugada=i.id_jugada LEFT JOIN turno ti ON ti.id_turno=ji.id_turno LEFT JOIN ataque a ON a.id_copia_atacante=cc.id_copia LEFT JOIN jugada ja ON ja.id_jugada=a.id_jugada LEFT JOIN turno ta ON ta.id_turno=ja.id_turno WHERE pp.id_partida=? GROUP BY cc.id_copia,cc.id_participante,cc.id_carta,cc.zona,cc.vida_actual,ca.vida_base,ti.numero_global ORDER BY cc.id_participante,cc.id_copia', [id]);
    const events = await this.rows(c, `SELECT j.id_jugada,j.orden_en_turno,t.numero_global,
      i.id_jugada AS invocacion_id,a.id_jugada AS ataque_id,
      COALESCE(i.id_copia,a.id_copia_atacante) AS id_copia,
      a.id_copia_objetivo,a.id_participante_objetivo,a.vida_previa_atacante,a.vida_previa_objetivo,
      origen.nombre AS nombre_carta,origen.ataque_base AS ataque_origen,
      objetivo.nombre AS nombre_objetivo,objetivo.ataque_base AS ataque_objetivo,
      m.id_jugador AS actor_id
      FROM jugada j JOIN turno t ON t.id_turno=j.id_turno
      LEFT JOIN invocacion i ON i.id_jugada=j.id_jugada LEFT JOIN ataque a ON a.id_jugada=j.id_jugada
      LEFT JOIN copia_carta_partida copia ON copia.id_copia=COALESCE(i.id_copia,a.id_copia_atacante)
      LEFT JOIN carta origen ON origen.id_carta=copia.id_carta
      LEFT JOIN copia_carta_partida destino ON destino.id_copia=a.id_copia_objetivo
      LEFT JOIN carta objetivo ON objetivo.id_carta=destino.id_carta
      JOIN participante_partida actor ON actor.id_partida=t.id_partida AND actor.posicion=IF(MOD(t.numero_global,2)=1,1,2)
      JOIN mazo m ON m.id_mazo=actor.id_mazo WHERE t.id_partida=?
      ORDER BY t.numero_global,j.orden_en_turno`, [id]);
    if (events.some(event => Number(event.invocacion_id !== null) + Number(event.ataque_id !== null) !== 1)) {
      throw new ApiError(503, 'ESTADO_SQL_INVALIDO', 'El historial contiene una jugada sin un único subtipo.');
    }
    const current = turns.at(-1);
    if (participants.length !== 2 || !current) throw new ApiError(503, 'ESTADO_SQL_INVALIDO', 'La partida no tiene el estado inicial completo.');
    const global = Number(current.numero_global);
    const activePosition = global % 2 ? 1 : 2;
    const players = participants.map(participant => {
      const copies = instances.filter(row => row.id_participante === participant.id_participante);
      const lastOwn = turns.filter(turn => (Number(turn.numero_global) % 2 ? 1 : 2) === Number(participant.posicion)).at(-1);
      const map = (row: Row): CardInstance => ({ id: String(row.id_copia), cardId: row.id_carta, health: row.vida_actual === null ? Number(row.vida_base) : Number(row.vida_actual), enteredTurn: row.invocado === null ? 0 : Number(row.invocado), lastAttackTurn: row.ultimo_ataque === null ? null : Number(row.ultimo_ataque) });
      return { id: String(participant.id_jugador), name: participant.alias, life: Number(participant.vida_heroe), energy: lastOwn ? Number(lastOwn.energia_disponible) : 0, maxEnergy: lastOwn ? Math.min(5, Math.floor((Number(lastOwn.numero_global) + 1) / 2)) : 0, hand: copies.filter(row => row.zona === 'MANO').map(map), field: copies.filter(row => row.zona === 'CAMPO').map(map), deckCount: copies.filter(row => row.zona === 'MAZO').length, discardCount: copies.filter(row => row.zona === 'DESCARTE').length, discard: copies.filter(row => row.zona === 'DESCARTE').map(map) } satisfies DemoPlayer;
    }) as [DemoPlayer, DemoPlayer];
    const history: DuelHistoryEvent[] = events.map(event => ({
      id: String(event.id_jugada), turn: Number(event.numero_global), order: Number(event.orden_en_turno),
      actorId: String(event.actor_id), type: event.invocacion_id !== null ? 'play' : 'attack', instanceId: String(event.id_copia),
      ...(event.ataque_id !== null ? {
        targetId: event.id_copia_objetivo === null ? 'hero' : String(event.id_copia_objetivo),
        previousAttackerHealth: Number(event.vida_previa_atacante), previousTargetHealth: Number(event.vida_previa_objetivo),
        attackerHealthAfter: event.id_copia_objetivo === null ? Number(event.vida_previa_atacante)
          : Math.max(0, Number(event.vida_previa_atacante) - Number(event.ataque_objetivo)),
        targetHealthAfter: Math.max(0, Number(event.vida_previa_objetivo) - Number(event.ataque_origen)),
      } : {}),
    }));
    const logs: string[] = [];
    for (const turn of turns) {
      const number = Number(turn.numero_global);
      logs.push(`Turno ${number}: ${players[(number % 2 ? 0 : 1)]!.name}, energía de apertura ${Math.min(5, Math.floor((number + 1) / 2))}.`);
      for (const event of events.filter(event => Number(event.numero_global) === number)) {
        const action = history.find(action => action.id === String(event.id_jugada))!;
        const actor = players.find(player => player.id === action.actorId)!;
        if (action.type === 'play') logs.push(`${actor.name} invocó ${event.nombre_carta} (copia ${event.id_copia}). Espera al próximo turno propio para atacar.`);
        else if (action.targetId === 'hero') {
          const rival = players.find(player => player.id !== action.actorId)!;
          logs.push(`${event.nombre_carta} (copia ${event.id_copia}) atacó al héroe de ${rival.name}: vida ${action.previousTargetHealth} → ${action.targetHealthAfter}.`);
        } else {
          logs.push(`${event.nombre_carta} (copia ${event.id_copia}) atacó a ${event.nombre_objetivo} (copia ${action.targetId}): daño simultáneo ${event.ataque_origen}/${event.ataque_objetivo}; vidas ${action.previousAttackerHealth} → ${action.attackerHealthAfter} y ${action.previousTargetHealth} → ${action.targetHealthAfter}.`);
          if (action.attackerHealthAfter === 0) logs.push(`${event.nombre_carta} (copia ${event.id_copia}) pasó al descarte.`);
          if (action.targetHealthAfter === 0) logs.push(`${event.nombre_objetivo} (copia ${action.targetId}) pasó al descarte.`);
        }
      }
    }
    if (game.fecha_fin !== null) logs.push(game.motivo_cierre==='REINICIO' ? 'Partida cerrada por reinicio. Historial conservado; sin victoria ni empate.' : game.ganador_posicion === null ? 'Partida finalizada en empate.' : `Partida finalizada: ganó ${players[Number(game.ganador_posicion) - 1]!.name}.`);
    return { id: String(game.id_partida), version: Number(game.version), turn: global, activePlayerId: players[activePosition - 1]!.id, players, status: game.fecha_fin === null ? 'active' : 'finished', winnerId: game.ganador_posicion === null ? null : players[Number(game.ganador_posicion) - 1]!.id, log: ['Partida persistente provisional, B1–B4 pendientes.', ...logs], mode: 'persistent', scenario: 'inicio', history,
      ...(game.fecha_fin === null ? {} : { result: { reason: game.motivo_cierre as 'VIDA_CERO' | 'LIMITE_TURNOS' | 'REINICIO', finishedAt: String(game.fecha_fin) } }),
    };
  }
}
