import type { Suit } from '../../../../shared/contracts';
import { SuitEmblem } from './SuitEmblem';

/** Original printed border and indices; the two corner marks are not central pips. */
export function CardFrame({ suit, value }: { suit: Suit; value: number }) {
  const breaks = { oros: 0, copas: 1, espadas: 2, bastos: 3 }[suit];
  return <g className="traditional-frame" fill="none" stroke="#66503a" strokeWidth=".7">
    <rect x="5" y="5" width="190" height="290" rx="6" />
    <path d="M12 20V13h30M158 13h30v7M12 280v7h30M158 287h30v-7" stroke="#b49357" strokeWidth=".8" />
    <path d="M43 13H157M43 287H157" stroke="#775632" />
    {Array.from({ length: breaks }, (_, i) => <path key={i} d={`M${100 + (i - (breaks - 1) / 2) * 12 - 3} 13h6M${100 + (i - (breaks - 1) / 2) * 12 - 3} 287h6`} stroke="#fffaf0" strokeWidth="3" />)}
    {[false, true].map(bottom => <g key={String(bottom)} data-corner-index={bottom ? 'bottom' : 'top'} transform={bottom ? 'translate(174 246) rotate(180)' : 'translate(26 32)'} stroke="none">
      <text className="traditional-index" x="0" y="10" textAnchor="middle" fill="#283b3b" fontFamily="Georgia, serif" fontSize="23" fontWeight="bold">{value}</text>
      <g transform="translate(-8 16) scale(.2)"><SuitEmblem suit={suit} /></g>
    </g>)}
  </g>;
}
