import type { Suit } from '../../../../shared/contracts';
import { CardFrame } from './CardFrame';
import { PipLayout, type PipValue } from './PipLayout';
import { CourtFigure } from './CourtFigure';

/** One deterministic face for all views; gameplay data stays in the HTTP Card DTO. */
export function TraditionalCardArt({ suit, value }: { suit: Suit; value: number }) {
  return <svg className="card-art card-illustration" viewBox="0 0 200 300" aria-hidden="true" data-art-suit={suit} data-art-value={value}>
    <CardFrame suit={suit} value={value} />
    <g className="traditional-central-art" transform="translate(32 44) scale(.85)">
      {value >= 1 && value <= 7 ? <PipLayout suit={suit} value={value as PipValue} />
        : value === 10 || value === 11 || value === 12 ? <g transform="translate(6 7) scale(.92)"><CourtFigure suit={suit} rank={value} /></g> : null}
    </g>
  </svg>;
}
