import type { ActionRequest, ActiveDuel, Card, CollectionCard, CreateDuelRequest, Deck, DeckInput, DuelState, HealthResponse, Player, StorageProvider } from '../../../shared/contracts.js';

/** HTTP boundary for memory and provisional MariaDB adapters; B1–B4 remain pending. */
export interface ArenaRepository {
  readonly source: string;
  readonly storage?: StorageProvider;
  listCards(): Card[] | Promise<Card[]>;
  listDecks(ownerId?: string): Deck[] | Promise<Deck[]>;
  saveDeck(input: DeckInput, id?: string): Deck | Promise<Deck>;
  deleteDeck(id: string, ownerId?: string): void | Promise<void>;
  createDuel(input: CreateDuelRequest): DuelState | Promise<DuelState>;
  getDuel(id: string): DuelState | Promise<DuelState>;
  act(id: string, request: ActionRequest): DuelState | Promise<DuelState>;
  health?(): HealthResponse | Promise<HealthResponse>;
  listPlayers?(): Player[] | Promise<Player[]>;
  createPlayer?(alias: string): Player | Promise<Player>;
  collection?(playerId: string): CollectionCard[] | Promise<CollectionCard[]>;
  activeDuels?(playerId: string): ActiveDuel[] | Promise<ActiveDuel[]>;
  close?(): Promise<void>;
}
