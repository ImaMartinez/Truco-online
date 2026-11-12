import type { DemoPlayer } from "../../../shared/contracts";
import { Icon } from "./Icon";

/** The current rules start both heroes at 20 life; the DTO provides current life only. */
export function LifeCounter({player,reverse=false}:{player:DemoPlayer;reverse?:boolean}){
 return <span className={`hero-life ${reverse?'is-reversed':''}`} data-life-player={player.id}>
  <Icon name="heart" size={18}/><strong>{player.life}<small>/20</small></strong>
  <span className={`life-meter ${reverse?'is-reversed':''}`} data-fill-direction={reverse?'rtl':'ltr'} role="meter" aria-label={`Vida de ${player.name}`} aria-valuemin={0} aria-valuemax={20} aria-valuenow={player.life}><i style={{width:`${Math.max(0,Math.min(100,player.life*5))}%`}}/></span>
 </span>;
}

export function EnergyCounter({
  value,
  maximum,
  preview = 0,
}: {
  value: number;
  maximum: number;
  preview?: number;
}) {
  return (
    <div
      className="energy-counter"
      aria-label={`Energía ${value} de ${maximum}`}
      data-preview-cost={preview}
      data-preview-affordable={preview <= value}
    >
      <span className="energy-dots">
        {Array.from({ length: 5 }, (_, i) => (
          <i
            className={`${i < value ? "filled" : i < maximum ? "spent" : ""} ${preview>0&&i<value&&i>=Math.max(0,value-preview)?'preview-spend':''} ${preview>value&&i>=value&&i<preview?'preview-missing':''}`}
            key={i}
          />
        ))}
      </span>
      <strong>
        {value}
        <span>/{maximum}</span>
      </strong>
      {preview>0&&<small className="energy-preview" role="status">{preview<=value?`−${preview} al invocar`:`Faltan ${preview-value}`}</small>}
    </div>
  );
}
export function PlayerPanel({
  player,
  active,
  rival = false,
  onHero,
  disabled = false,
  energyPreview = 0,
  summaryOnly = false,
}: {
  player: DemoPlayer;
  active?: boolean;
  rival?: boolean;
  onHero?: () => void;
  disabled?: boolean;
  energyPreview?: number;
  summaryOnly?: boolean;
}) {
  const hero = (
    <>
      <span className={`avatar ${rival ? "rival-avatar" : ""}`}>
        {rival ? "II" : "I"}
      </span>
      <span className="player-identity">
        <strong>{player.name}</strong>
        <small>
          <span className="player-card-count">En mazo: <b>{player.deckCount}</b></span>
          <span className="player-card-count">En mano: <b>{player.handCount ?? player.hand.length}</b></span>
          <span className="player-card-count">Descartadas: <b>{player.discardCount}</b></span>
        </small>
      </span>
    </>
  );
  return (
    <div className={`player-panel ${active ? "active-player" : ""}`} data-hero-player={player.id}>
      {onHero ? (
        <button
          className="hero-target"
          disabled={disabled}
          onClick={onHero}
          aria-label={`Atacar héroe de ${player.name}, ${player.life} de vida`}
        >
          {hero}
        </button>
      ) : (
        <div className="hero-target">{hero}</div>
      )}
      {!summaryOnly&&<div className="player-resources">
        <LifeCounter player={player}/>
        <EnergyCounter value={player.energy} maximum={player.maxEnergy} preview={energyPreview} />
      </div>}
    </div>
  );
}
