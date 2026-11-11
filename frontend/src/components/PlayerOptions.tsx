import type { Player } from '../../../shared/contracts';
import { isDemoPlayer, visiblePlayers } from '../playerDirectory';

export function PlayerOptions({ players, disabledId }: { players: Player[]; disabledId?: string }) {
  const visible = visiblePlayers(players);
  return <>{[['Jugadores', false], ['Demostración', true]].map(([label, demo]) => {
    const group = visible.filter(player => isDemoPlayer(player) === demo);
    return group.length ? <optgroup key={String(label)} label={String(label)}>{group.map(player =>
      <option key={player.id} value={player.id} disabled={player.id === disabledId}>{player.alias}</option>)}</optgroup> : null;
  })}{!visible.length && <option value="">No hay jugadores disponibles</option>}</>;
}
