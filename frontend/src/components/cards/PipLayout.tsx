import type { Suit } from "../../../../shared/contracts";
import { SuitEmblem } from "./SuitEmblem";
import { AceIllustration } from './AceIllustration';

export type PipValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface PipPlacement { x: number; y: number; scale: number; inverted?: boolean }

/** Centers in a 160 × 240 art box; corner indices are separate and never counted. */
export const PIP_LAYOUTS: Readonly<Record<PipValue, readonly PipPlacement[]>> = {
  1: [{ x: 80, y: 120, scale: 1.6 }],
  2: [{ x: 80, y: 65, scale: 1.04 }, { x: 80, y: 175, scale: 1.04, inverted: true }],
  3: [{ x: 80, y: 42, scale: .72 }, { x: 80, y: 120, scale: .72 }, { x: 80, y: 198, scale: .72, inverted: true }],
  4: [{ x: 42, y: 62, scale: .9 }, { x: 118, y: 62, scale: .9 }, { x: 42, y: 178, scale: .9, inverted: true }, { x: 118, y: 178, scale: .9, inverted: true }],
  5: [{ x: 41, y: 44, scale: .72 }, { x: 119, y: 44, scale: .72 }, { x: 80, y: 120, scale: .72 }, { x: 41, y: 196, scale: .72, inverted: true }, { x: 119, y: 196, scale: .72, inverted: true }],
  6: [{ x: 42, y: 42, scale: .72 }, { x: 118, y: 42, scale: .72 }, { x: 42, y: 120, scale: .72 }, { x: 118, y: 120, scale: .72 }, { x: 42, y: 198, scale: .72, inverted: true }, { x: 118, y: 198, scale: .72, inverted: true }],
  7: [{ x: 29, y: 42, scale: .62 }, { x: 131, y: 42, scale: .62 }, { x: 29, y: 120, scale: .62 }, { x: 80, y: 120, scale: .62 }, { x: 131, y: 120, scale: .62 }, { x: 29, y: 198, scale: .62, inverted: true }, { x: 131, y: 198, scale: .62, inverted: true }],
};

export function PipLayout({ suit, value }: { suit: Suit; value: PipValue }) {
  return (
    <g className="central-pips" data-pip-value={value} data-pip-suit={suit}>
      {value === 1 ? <AceIllustration suit={suit} /> : PIP_LAYOUTS[value].map((pip, index) => (
        <g key={index} data-central-pip="true" data-pip-index={index + 1}
          transform={`translate(${pip.x} ${pip.y}) rotate(${pip.inverted ? 180 : 0}) scale(${pip.scale}) translate(-40 -50)`}>
          <SuitEmblem suit={suit} />
        </g>
      ))}
    </g>
  );
}
