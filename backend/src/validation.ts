import type { ActionRequest, CreateDuelRequest, DeckInput } from '../../shared/contracts.js';
import { invalid } from './errors.js';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Se esperaba un objeto JSON.');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/u.test(value)) {
    invalid(`${label} debe ser un texto de 1 a ${max} caracteres.`);
  }
  return value.trim();
}

export function deckInput(value: unknown): DeckInput {
  const body = object(value);
  if (!Array.isArray(body.entries) || body.entries.length > 20) invalid('El mazo admite hasta 20 tipos de carta.');
  return {
    ...(body.ownerId === undefined ? {} : { ownerId: text(body.ownerId, 'El dueño', 80) }),
    name: text(body.name, 'El nombre', 60),
    description: body.description === undefined || body.description === '' ? '' : text(body.description, 'La descripción', 200),
    entries: body.entries.map(value => {
      const entry = object(value);
      if (!Number.isInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 2) {
        invalid('Cada tipo debe tener una o dos copias.');
      }
      return { cardId: text(entry.cardId, 'La carta', 10), quantity: Number(entry.quantity) };
    }),
  };
}

export function createDuelInput(value: unknown): CreateDuelRequest {
  const body = object(value ?? {});
  if (body.scenario !== undefined && body.scenario !== 'inicio' && body.scenario !== 'mesa-abierta') {
    invalid('El escenario debe ser inicio o mesa-abierta.');
  }
  const input: CreateDuelRequest = { scenario: body.scenario as CreateDuelRequest['scenario'] };
  if(body.replaceActive!==undefined){if(typeof body.replaceActive!=='boolean')invalid('replaceActive debe ser booleano.');input.replaceActive=body.replaceActive;}
  if (body.requestId !== undefined) input.requestId = requestIdInput(body.requestId);
  if (body.deckIds !== undefined) {
    if (!Array.isArray(body.deckIds) || body.deckIds.length !== 2) invalid('Elegí dos mazos para la mesa.');
    input.deckIds = [text(body.deckIds[0], 'El mazo', 80), text(body.deckIds[1], 'El mazo', 80)];
  }
  if (body.playerIds !== undefined) {
    if (!Array.isArray(body.playerIds) || body.playerIds.length !== 2) invalid('Elegí dos jugadores para la mesa.');
    input.playerIds = [text(body.playerIds[0], 'El jugador', 80), text(body.playerIds[1], 'El jugador', 80)];
  }
  return input;
}

export function requestIdInput(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    invalid('requestId debe ser un UUID canónico en minúsculas; reutilizalo al reintentar.');
  }
  return value;
}

export function playerInput(value: unknown): string {
  return text(object(value).alias, 'El alias', 40);
}

export function actionInput(value: unknown): ActionRequest {
  const body = object(value);
  if (!Number.isSafeInteger(body.expectedVersion) || Number(body.expectedVersion) < 1 || Number(body.expectedVersion) > 4294967295) invalid('Falta la versión válida de la mesa.');
  const action = object(body.action);
  const expectedVersion = Number(body.expectedVersion);
  const context = {
    ...(body.actorId === undefined ? {} : { actorId: text(body.actorId, 'El actor', 80) }),
    ...(body.requestId === undefined ? {} : { requestId: requestIdInput(body.requestId) }),
  };
  switch (action.type) {
    case 'play': return { ...context, expectedVersion, action: { type: 'play', instanceId: text(action.instanceId, 'La copia', 80) } };
    case 'attack': return { ...context, expectedVersion, action: { type: 'attack', attackerId: text(action.attackerId, 'El atacante', 80), targetId: text(action.targetId, 'El objetivo', 80) } };
    case 'endTurn': return { ...context, expectedVersion, action: { type: 'endTurn' } };
    default: return invalid('Acción desconocida. Elegí invocar, atacar o finalizar turno.');
  }
}
