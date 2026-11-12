import type {
  ActionRequest,
  CatalogResponse,
  CreateDuelRequest,
  Deck,
  DeckInput,
  DecksResponse,
  DuelState,
  HealthResponse,
  PlayersResponse,
  CollectionResponse,
  ActiveDuelsResponse,
  Player,
} from "../../shared/contracts";
import {anchorOnlineClock} from './onlineClock';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 0,
  ) {
    super(message);
  }
}

export async function request<T>(path: string, options?: RequestInit, acceptedStatuses: number[] = []): Promise<T> {
  const sentAt=performance.now();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new ApiError(
      "No pudimos conectar con la API. Comprobá que el backend esté encendido y volvé a intentar.",
      "NETWORK_ERROR",
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "La API local no está disponible. Iniciá el backend y volvé a intentar.",
      "INVALID_RESPONSE",
    );
  }
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    const error = payload as { error?: { message?: string; code?: string } };
    throw new ApiError(
      error.error?.message ?? "No se pudo completar la acción.",
      error.error?.code ?? "REQUEST_ERROR",
      response.status,
    );
  }
  const timer=(payload as {onlineTimer?:import('../../shared/contracts').OnlineTimerState})?.onlineTimer;
  if(timer)anchorOnlineClock(timer,sentAt,performance.now());
  return payload as T;
}

/** Stable HTTP boundary: views know nothing about the demo repository or future SQL. */
export const api = {
  health: () => request<HealthResponse>("/health", undefined, [503]),
  catalog: () => request<CatalogResponse>("/catalog"),
  decks: (ownerId?: string) => request<DecksResponse>(ownerId ? `/decks?ownerId=${encodeURIComponent(ownerId)}` : "/decks"),
  players: () => request<PlayersResponse>("/players"),
  deleteDeck: (id: string, ownerId?: string) => request<{deleted: boolean}>(`/decks/${encodeURIComponent(id)}${ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''}`, { method: 'DELETE' }),
  createPlayer: (alias: string) => request<Player>("/players", { method: "POST", body: JSON.stringify({ alias }) }),
  collection: (playerId: string) => request<CollectionResponse>(`/players/${encodeURIComponent(playerId)}/collection`),
  activeDuels: (playerId: string) => request<ActiveDuelsResponse>(`/players/${encodeURIComponent(playerId)}/duels`),
  saveDeck: (input: DeckInput, id?: string) =>
    request<Deck>(id ? `/decks/${encodeURIComponent(id)}` : "/decks", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    }),
  createDuel: (input: CreateDuelRequest) =>
    request<DuelState>("/duels", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  duel: (id: string) => request<DuelState>(`/duels/${encodeURIComponent(id)}`),
  action: (id: string, input: ActionRequest) =>
    request<DuelState>(`/duels/${encodeURIComponent(id)}/actions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};

/** Keep the original command/key when a response may have been lost after commit. */
export const uncertainFailure = (error: unknown) => !(error instanceof ApiError)
  || error.status === 0 || error.status >= 500;
