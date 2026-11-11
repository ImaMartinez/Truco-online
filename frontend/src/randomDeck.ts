import type { Card, DeckEntry } from '../../shared/contracts';
import {DECK_SIZE} from '../../shared/deck-rules';

export interface RandomDeckDraft { ownerId?: string; entries: DeckEntry[] }

/** Sample physical copies without replacement; final validation remains in the API/SQL. */
export function randomDeck(cards: Card[], quantities?: Record<string, number>, random = Math.random): DeckEntry[] {
  const pool = [...new Set(cards.map(card => card.id))].flatMap(id =>
    Array.from({ length: Math.min(2, Math.max(0, Math.floor(quantities ? quantities[id] ?? 0 : 2))) }, () => id));
  if (pool.length < DECK_SIZE) throw new Error('Tu colección no tiene veinte cartas disponibles para armar un mazo.');
  for (let i = 0; i < DECK_SIZE; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const entries = new Map<string, number>();
  for (const id of pool.slice(0,DECK_SIZE)) entries.set(id, (entries.get(id) ?? 0) + 1);
  return [...entries].map(([cardId, quantity]) => ({ cardId, quantity }));
}
