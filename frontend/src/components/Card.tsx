import type { Card as CardData, CardInstance } from "../../../shared/contracts";
import type { MouseEvent, CSSProperties } from "react";
import { SpriteCardArt } from "./cards/SpriteCardArt";
import { GameBadges } from "./cards/GameBadges";

interface Props {
  card: CardData;
  instance?: CardInstance;
  selected?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  compact?: boolean;
  className?: string;
  status?: string;
}
export function Card({
  card,
  instance,
  selected,
  disabled,
  onClick,
  compact,
  className = "",
  status,
}: Props) {
  const health = instance?.health ?? card.health;
  const label = `${card.name}, energía ${card.cost}, ataque ${card.attack}, vida ${health}${status?`, ${status}`:''}`;
  const content = (
    <>
      <div className="card-paper" aria-hidden="true">
        <SpriteCardArt code={card.id} />
      </div>
      <GameBadges energy={card.cost} attack={card.attack} health={health} baseHealth={card.health} />
    </>
  );
  const props = {
    className: `playing-card traditional-card sprite-card suit-${card.suit} ${selected ? "selected" : ""} ${compact ? "compact" : ""} ${className}`,
    "data-card-id": card.id,
    "data-instance-id": instance?.id,
    "aria-label": label,
    title: status,
  };
  return onClick ? (
    <button
      {...props}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={Boolean(selected)}
    >
      {content}
    </button>
  ) : (
    <div {...props} role="img">
      {content}
    </div>
  );
}

export function CardBack({ small = false, style }: { small?: boolean; style?: CSSProperties }) {
  return (
    <div className={`card-back ${small ? "small" : ""}`} style={style} aria-hidden="true">
      <div>
        <span>TA</span>
        <i>✦</i>
      </div>
    </div>
  );
}
