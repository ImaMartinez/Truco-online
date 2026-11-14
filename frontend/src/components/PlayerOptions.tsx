import type { Player } from '../../../shared/contracts';
import { isDemoPlayer, visiblePlayers } from '../playerDirectory';

export function PlayerOptions({ players, disabledId, currentPlayer }: { players: Player[]; disabledId?: string; currentPlayer?: Player }) {
  // An authenticated identity must not be hidden by the local fixture-name filter.
  if (currentPlayer) return <option value={currentPlayer.id} disabled={currentPlayer.id === disabledId}>{currentPlayer.alias}</option>;
  const visible = visiblePlayers(players);
  return <>{[['Jugadores', false], ['Demostración', true]].map(([label, demo]) => {
    const group = visible.filter(player => isDemoPlayer(player) === demo);
    return group.length ? <optgroup key={String(label)} label={String(label)}>{group.map(player =>
      <option key={player.id} value={player.id} disabled={player.id === disabledId}>{player.alias}</option>)}</optgroup> : null;
  })}{!visible.length && <option value="">No hay jugadores disponibles</option>}</>;
}
