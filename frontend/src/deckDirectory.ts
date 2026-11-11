import type {Deck} from '../../shared/contracts';

export const COMPUTER_DECK_DESCRIPTION='Mazo aleatorio de la computadora';
const automaticName=/^PC\s*·\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Compatibility marker used by the automatic builder, not an ownership or authorization check. */
export function isComputerDeck(deck:Pick<Deck,'name'|'description'>):boolean{
 return deck.description?.trim()===COMPUTER_DECK_DESCRIPTION&&automaticName.test(deck.name.trim());
}

export const playerDecks=(decks:Deck[])=>decks.filter(deck=>!isComputerDeck(deck));
