import express from 'express';
import type { ErrorRequestHandler, Request, Response } from 'express';
import type { DuelState, HealthResponse } from '../../shared/contracts.js';
import type { ArenaRepository } from './repositories/arena-repository.js';
import { DemoRepository } from './demo/demo-repository.js';
import { ApiError, invalid } from './errors.js';
import { actionInput, createDuelInput, deckInput, playerInput, requestIdInput } from './validation.js';

function idempotencyKey(req: Request, bodyKey?: string): string | undefined {
  const header = req.get('Idempotency-Key');
  if (header === undefined) return bodyKey;
  const key = requestIdInput(header);
  if (bodyKey !== undefined && bodyKey !== key) invalid('Idempotency-Key y requestId deben coincidir.');
  return key;
}

function operationHeaders(res: Response, state: DuelState): void {
  if (state.operation) {
    res.setHeader('Idempotency-Replayed', String(state.operation.replayed));
    res.setHeader('Operation-Version', String(state.operation.versionResult));
  }
}

export function createApp(repository: ArenaRepository = new DemoRepository()) {
  const app = express();
  const mode = repository.storage === 'mariadb' ? 'persistent' : 'demo';
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', async (_req, res) => {
    const health: HealthResponse = repository.health ? await repository.health()
      : { status: 'ok', service: 'truco-arena-api', mode: 'demo', storage: 'memory', database: 'not-connected', agreements: 'pending' };
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  });
  app.get('/api/catalog', async (_req, res) => { res.json({ cards: await repository.listCards(), mode, source: repository.source }); });
  app.get('/api/players', async (_req, res) => {
    if (!repository.listPlayers) throw new ApiError(501, 'FUNCION_NO_IMPLEMENTADA', 'Los perfiles persistentes requieren ARENA_STORAGE=mariadb.');
    res.json({ players: await repository.listPlayers(), mode });
  });
  app.post('/api/players', async (req, res) => {
    if (!repository.createPlayer) throw new ApiError(501, 'FUNCION_NO_IMPLEMENTADA', 'Los perfiles persistentes requieren ARENA_STORAGE=mariadb.');
    res.status(201).json(await repository.createPlayer(playerInput(req.body)));
  });
  app.get('/api/players/:id/collection', async (req, res) => {
    if (!repository.collection) throw new ApiError(501, 'FUNCION_NO_IMPLEMENTADA', 'Las colecciones persistentes requieren ARENA_STORAGE=mariadb.');
    res.json({ cards: await repository.collection(String(req.params.id)), mode });
  });
  app.get('/api/players/:id/duels', async (req, res) => {
    if (!repository.activeDuels) throw new ApiError(501, 'FUNCION_NO_IMPLEMENTADA', 'El historial persistente requiere ARENA_STORAGE=mariadb.');
    if (req.query.status !== undefined && req.query.status !== 'active') invalid('Este corte permite consultar status=active.');
    res.json({ duels: await repository.activeDuels(String(req.params.id)), mode });
  });
  app.get('/api/decks', async (req, res) => {
    if (req.query.ownerId !== undefined && typeof req.query.ownerId !== 'string') invalid('ownerId debe indicar un jugador.');
    res.json({ decks: await repository.listDecks(req.query.ownerId), mode });
  });
  app.post('/api/decks', async (req, res) => { res.status(201).json(await repository.saveDeck(deckInput(req.body))); });
  app.put('/api/decks/:id', async (req, res) => { res.json(await repository.saveDeck(deckInput(req.body), String(req.params.id))); });
  app.delete('/api/decks/:id', async (req, res) => {
    if (req.query.ownerId !== undefined && typeof req.query.ownerId !== 'string') invalid('ownerId debe indicar un jugador.');
    await repository.deleteDeck(String(req.params.id), req.query.ownerId);
    res.json({ deleted: true });
  });
  app.post('/api/duels', async (req, res) => {
    const input = createDuelInput(req.body);
    input.requestId = idempotencyKey(req, input.requestId);
    const state = await repository.createDuel(input);
    operationHeaders(res, state);
    res.status(state.operation?.replayed ? 200 : 201).json(state);
  });
  app.get('/api/duels/:id', async (req, res) => { res.json(await repository.getDuel(String(req.params.id))); });
  app.post('/api/duels/:id/actions', async (req, res) => {
    const input = actionInput(req.body);
    input.requestId = idempotencyKey(req, input.requestId);
    const state = await repository.act(String(req.params.id), input);
    operationHeaders(res, state);
    res.json(state);
  });
  app.use((_req, res) => { res.status(404).json({ error: { code: 'RUTA_NO_ENCONTRADA', message: 'La ruta solicitada no existe.' } }); });
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    const bodyError = error as { type?: string };
    if (bodyError?.type === 'entity.parse.failed') { res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'El cuerpo no contiene JSON válido.' } }); return; }
    if (bodyError?.type === 'entity.too.large') { res.status(413).json({ error: { code: 'SOLICITUD_EXCESIVA', message: 'La solicitud supera el tamaño permitido.' } }); return; }
    console.error('Error interno en la API:', error instanceof Error ? error.name : 'desconocido');
    res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'No pudimos completar la operación.' } });
  };
  app.use(onError);
  return app;
}
