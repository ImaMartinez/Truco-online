/** Game attributes are visually separate from the printed Spanish-card face. */
export function GameBadges({ energy, attack, health, baseHealth }: { energy: number; attack: number; health: number; baseHealth: number }) {
  return <>
    <span className="card-cost" title="Energía" data-stat="energy" data-stat-value={energy}>{energy}</span>
    <div className="card-stats">
      <span className="attack-stat" title="Ataque" data-stat="attack" data-stat-value={attack}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 16 11-12 2-1-1 3L6 17m-2-5 5 5m-7 1 2-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>{attack}
      </span>
      <span className={`health-stat ${health < baseHealth ? 'damaged' : ''}`} title="Vida" data-stat="health" data-stat-value={health}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17 3 10C-1 5 5-1 10 5c5-6 11 0 7 5Z" fill="currentColor" /></svg>{health}
      </span>
    </div>
  </>;
}
