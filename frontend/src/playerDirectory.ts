import type { Player } from '../../shared/contracts';

// Temporary naming convention for the existing database, which has no profile category column.
export function isTestName(name: string): boolean {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return /^(?:tests?|pruebas?|testing|e2e)(?:$|[\s_\-])/i.test(normalized);
}
export const isDemoPlayer = (player: Player) => /\bdemo\b/i.test(player.alias);
export function visiblePlayers(players: Player[]): Player[] {
  return players.filter(player => !isTestName(player.alias)
    && !/^(?:UI|Retry|Combate)\s.+\s[0-9a-f]{8}$/i.test(player.alias.trim()))
    .filter(player => !/^combate-[0-9a-f]{8}-[0-9a-f-]+$/i.test(player.alias.trim())
      && !/^Academia TA v1 Jugador \d+$/i.test(player.alias.trim()))
    .sort((a,b) => a.alias.localeCompare(b.alias, 'es'));
}
