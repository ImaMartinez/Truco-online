/** Playable edition: new decks use twenty cards; twelve-card legacy matches remain supported. */
export const DECK_SIZE = 20;
export const LEGACY_DECK_SIZE = 12;
export const isPlayableDeckSize = (size:number) => size === DECK_SIZE || size === LEGACY_DECK_SIZE;
