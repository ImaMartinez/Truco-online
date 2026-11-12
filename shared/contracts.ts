/** HTTP contracts shared by memory and provisional SQL; not approved academic entities. */
export type Suit = 'espadas' | 'bastos' | 'oros' | 'copas';
export type StorageProvider = 'memory' | 'mariadb' | 'supabase';
export type DataMode = 'demo' | 'persistent';

export interface Card {
  id: string;
  name: string;
  suit: Suit;
  number: number;
  attack: number;
  health: number;
  cost: number;
  hierarchy: number;
}

export interface DeckEntry { cardId: string; quantity: number }
export interface Deck {
  id: string;
  name: string;
  description: string;
  entries: DeckEntry[];
  ownerId?: string;
  used?: boolean;
}
export interface DeckInput { name: string; description?: string; entries: DeckEntry[]; ownerId?: string }
export interface Player { id: string; alias: string }
export interface CollectionCard extends Card { quantity: number }
export interface PlayersResponse { players: Player[]; mode: DataMode }
export interface CollectionResponse { cards: CollectionCard[]; mode: DataMode }
export interface ActiveDuel { id: string; turn: number; version: number; startedAt: string }
export interface ActiveDuelsResponse { duels: ActiveDuel[]; mode: DataMode }
export interface CardInstance {
  id: string;
  cardId: string;
  health: number;
  enteredTurn: number;
  lastAttackTurn: number | null;
}
export interface DemoPlayer {
  /** Remote rivals expose this count, never their actual hand. */
  handCount?: number;
  id: string;
  name: string;
  life: number;
  energy: number;
  maxEnergy: number;
  hand: CardInstance[];
  field: CardInstance[];
  deckCount: number;
  discardCount: number;
  /** Present in SQL snapshots; memory simulator keeps its existing count-only DTO. */
  discard?: CardInstance[];
}
export interface DuelHistoryEvent {
  id: string;
  turn: number;
  order: number;
  actorId: string;
  type: 'play' | 'attack';
  instanceId: string;
  targetId?: string | 'hero';
  previousAttackerHealth?: number;
  previousTargetHealth?: number;
  attackerHealthAfter?: number;
  targetHealthAfter?: number;
}
export type DemoScenario = 'mesa-abierta' | 'inicio';
export interface DuelState {
  onlineTimer?:OnlineTimerState;
  room?:{id:string;code:string;status:RoomStatus};
  opponentConnection?:{status:'online'|'not-recent'|'unknown';lastSeen?:string};
  cpu?:{playerId:string;difficulty:'facil'|'normal'|'dificil'};
  /** Present only on authenticated snapshots. Perspective never changes to the rival. */
  viewerPlayerId?: string;
  id: string;
  version: number;
  turn: number;
  activePlayerId: string;
  players: [DemoPlayer, DemoPlayer];
  status: 'active' | 'finished';
  winnerId: string | null;
  log: string[];
  mode: DataMode;
  scenario: DemoScenario;
  operation?: { requestId: string; replayed: boolean; versionResult: number };
  /** Successful persisted actions, ordered by global turn and action order. */
  history?: DuelHistoryEvent[];
  result?: { reason: 'VIDA_CERO' | 'LIMITE_TURNOS' | 'REINICIO' | 'INACTIVIDAD' | 'ABANDONO'; finishedAt: string };
}
export interface OnlineTimerState {
 turnId:string;serverNow:string;openedAt:string;deadlineAt:string;durationSeconds:number;running:boolean;
 lastClosure:{turn:number;reason:'MANUAL'|'TIEMPO_AGOTADO'|'FIN_PARTIDA';closedAt:string}|null;
 inactivity:{playerId:string;count:number}[];
}
export type RoomStatus='ESPERANDO'|'EN_CURSO'|'FINALIZADA'|'CANCELADA'|'EXPIRADA';
export interface RoomState {
 id:string;code:string;status:RoomStatus;duelId:string|null;expiresAt:string;replayed?:boolean;
 host:{id:string;alias:string;deckId:string;deckName:string;deckSize:number};
 guest:{id:string;alias:string}|null;
}
export interface RoomPreview {code:string;hostAlias:string;deckSize:number;expiresAt:string}
export type DuelAction =
  | { type: 'play'; instanceId: string }
  | { type: 'attack'; attackerId: string; targetId: string | 'hero' }
  | { type: 'endTurn' };
export interface ActionRequest { expectedVersion: number; action: DuelAction; actorId?: string; requestId?: string }
export interface CreateDuelRequest { scenario?: DemoScenario; deckIds?: [string, string]; playerIds?: [string, string]; requestId?: string; replaceActive?: boolean }
export interface CatalogResponse { cards: Card[]; mode: DataMode; source: string }
export interface DecksResponse { decks: Deck[]; mode: DataMode }
export interface ApiErrorResponse { error: { code: string; message: string } }
export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: 'truco-arena-api';
  mode: DataMode;
  storage: StorageProvider;
  database: 'not-connected' | 'connected' | 'unavailable';
  agreements: 'pending';
}
