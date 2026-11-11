import type { Suit } from "../../../shared/contracts";
import { SuitEmblem } from "./cards/SuitEmblem";

/** The same original suit artwork is reused in corners, filters and deck thumbnails. */
export function SuitSymbol({ suit, className = "" }: { suit: Suit; className?: string }) {
  return (
    <svg className={`suit-symbol ${className}`} viewBox="0 0 80 100" aria-hidden="true" focusable="false">
      <SuitEmblem suit={suit} />
    </svg>
  );
}
