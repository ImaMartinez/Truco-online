import type { Suit } from "../../../../shared/contracts";
import { SuitEmblem } from "./SuitEmblem";

type Rank = 10 | 11 | 12;
type Livery = { coat: string; dark: string; sleeve: string; cape: string; hose: string; horse: string; mane: string };
const ink = "#3d3026";
const gold = "#e5b441";
const cream = "#fff4d6";
const skin = "#edc39a";
const liveries: Record<Suit, Livery> = {
  espadas: { coat: "#c53d35", dark: "#8d2e2d", sleeve: "#32798e", cape: "#2d7184", hose: "#d6b13d", horse: "#e9dfc4", mane: "#655344" },
  bastos: { coat: "#437c4d", dark: "#2d593b", sleeve: "#c74434", cape: "#b53730", hose: "#d2aa39", horse: "#b77c49", mane: "#4d3a2b" },
  oros: { coat: "#b94430", dark: "#87382e", sleeve: "#3d7757", cape: "#c59b38", hose: "#377b8d", horse: "#e7c893", mane: "#7b4b2f" },
  copas: { coat: "#397d92", dark: "#2e596f", sleeve: "#c03c37", cape: "#a83231", hose: "#d4aa40", horse: "#e8e3d3", mane: "#605043" },
};

/** Hand-drawn original figures. Coordinates belong to the shared 160 × 240 art area. */
export function CourtFigure({ suit, rank }: { suit: Suit; rank: Rank }) {
  const palette = liveries[suit];
  return (
    <g
      className="court-figure"
      data-court-rank={rank}
      data-court-suit={suit}
      data-figure={rank === 10 ? "sota" : rank === 11 ? "caballo" : "rey"}
      stroke={ink}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {rank === 10 ? <Sota suit={suit} colors={palette} /> : rank === 11 ? <Caballo suit={suit} colors={palette} /> : <Rey suit={suit} colors={palette} />}
    </g>
  );
}

function Face({ x, y, beard = false, silver = false }: { x: number; y: number; beard?: boolean; silver?: boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <path d="M-12-5q-2-13 11-15Q14-20 14-5l-2 15q-3 9-12 10-10-2-12-12z" fill={skin} />
    <path d="M-11-1q-7-6-7 1 0 8 7 7M12-1q6-6 6 1 0 7-6 7" fill={skin} />
    <path d="M-12 5q-6-20 7-26 15-5 20 9l-2 13-4-10-6 1-6-2-6 10-1 7Z" fill={silver ? "#d8cdb1" : "#61412f"} />
    <path d="m-7 0 4-1m7 0 4 1" fill="none" strokeWidth="1.1" />
    <path d="M-5 3h1m10 0h1" fill="none" strokeWidth="1.9" />
    <path d="m1 3-2 6 4 1M-3 14q4 2 7-1" fill="none" strokeWidth=".9" />
    <path d="M-9 9q3 2 5 1m11 0 3-1" fill="none" stroke="#bc8765" strokeWidth=".7" />
    {beard && <>
      <path d="M-11 9q2 8 9 5l3 2 4-3q7 2 7-5l-1 12-10 10-10-10z" fill={silver ? "#ded3b7" : "#6b4730"} />
      <path d="m-6 17 4 7m3-7 1 9m4-11-1 9" fill="none" stroke={silver ? "#ac9a7c" : "#a27746"} strokeWidth=".85" />
      <path d="M-5 13q3-5 6-1 4-4 7 0" fill="none" strokeWidth="1.1" />
    </>}
  </g>;
}

function Embroidery({ x, y, width = 32, color = gold }: { x: number; y: number; width?: number; color?: string }) {
  return <g fill={color} strokeWidth=".7">
    <path d={`M${x} ${y}h${width}v5h-${width}z`} />
    {Array.from({ length: 5 }, (_, i) => <path key={i} d={`m${x + 3 + i * (width - 6) / 4} ${y + 1} 2 1.5-2 1.5-2-1.5z`} fill={cream} />)}
  </g>;
}

function Ground({ suit }: { suit: Suit }) {
  return <g strokeWidth=".9">
    <path d="M20 226q53-6 121 0" fill="none" stroke="#8b7043" />
    <path d="m27 226-4-7m4 7 3-10m97 9 5-8m-5 8-2-10M50 224l-2-5m65 6 2-6" fill="none" stroke="#658253" />
    <path d="M24 221q-7 1-8-4 7-1 8 4m108-2q7 0 8-4-7 0-8 4" fill="#66834f" stroke="#46663e" />
    <path d="M76 228h12m-46 2h7m59-1h10" fill="none" stroke="#bb9b62" />
    {suit === "copas" && <path d="m33 221 2-3 2 3-2 2z" fill="#be4131" />}
  </g>;
}

function HeldSuit({ suit, x, y, height = 75 }: { suit: Suit; x: number; y: number; height?: number }) {
  const tall = suit === "espadas" || suit === "bastos";
  const sy = (tall ? height : height * .64) / 100;
  const sx = tall ? .44 : .51;
  return <g data-court-suit-object={suit} transform={`translate(${x - 40 * sx} ${y - 92 * sy}) scale(${sx} ${sy})`}><SuitEmblem suit={suit} /></g>;
}

function Sota({ suit, colors: c }: { suit: Suit; colors: Livery }) {
  const turned = suit === "bastos" || suit === "copas";
  return <g data-court-body="standing" data-court-human="sota">
    <Ground suit={suit} />
    {/* Short cloak, doublet, paned sleeves and hose: the Spanish standing page. */}
    <path d="M59 67 46 77 40 141q11 11 25 7l4-75" fill={c.cape} />
    <path d="m51 88-5 45m10-39-4 45" fill="none" stroke={gold} strokeWidth="1.3" />
    <path d="m64 139-8 34 5 35 15 1 2-40 5-23z" fill={c.hose} />
    <path d="m82 140 9 35-3 35 16 1 4-41-9-32z" fill={c.sleeve} />
    <path d="m61 173 14 1m-13 9h12m-12 8h11m19-14h13m-14 9h13m-14 9h12" fill="none" stroke={cream} strokeWidth="3" />
    <path d="M61 199h16l-1 17 1 8H49q-5-1-2-5l13-5Zm29 0h14l-3 14 11 6q5 5-2 6H87l1-11Z" fill="#6c4a30" />
    <path d="M62 202h13m16 0h11m-39 4h11m17 0h9" fill="none" stroke={gold} strokeWidth="1" />
    <path d="M50 221h23m17 0h17" fill="none" stroke={gold} />
    <path d="M63 65q15-7 32 1l11 67-14 19-14-7-18 8-7-16z" fill={c.coat} />
    <path d="M77 72v65m0-45-18-8m18 8 22-9" fill="none" stroke={gold} strokeWidth="2" />
    <path d="m77 73-9 15 9 8 9-8z" fill={c.sleeve} />
    <path d="M65 65 52 73q-7 6-6 18l12 15 12-13z" fill={c.sleeve} />
    <path d="m51 76 10 17m-7-19 9 15m-12 3 9 8" fill="none" stroke={gold} strokeWidth="3" />
    <path d="m48 93-7 22 16 13 7-9-13-9 8-11" fill={c.coat} />
    <path d="m55 118 5-4 9 7-1 7-5 2-7-5z" fill={skin} />
    <path d="m60 119 4 4m-3-6 5 5" fill="none" strokeWidth=".7" />
    <path d="M94 65q15-2 20 13l-8 17-13-4-5-18z" fill={c.sleeve} />
    <path d="m99 70 4 17m3-14 3 12m-12 0 9 4" fill="none" stroke={gold} strokeWidth="3" />
    <path d="m108 88 16 13-4 19-9-2 3-14-14-8z" fill={c.coat} />
    <Embroidery x={57} y={132} width={45} />
    <path d="M55 127h48v7H55z" fill="#7d5130" />
    <rect x="76" y="127" width="10" height="7" rx="1" fill={gold} />
    <path d="m81 137-1 11m-15-12-5 12m35-11 3 10" fill="none" stroke={gold} />
    <path d="M69 62v8q8 6 17 0v-9" fill={skin} />
    <Face x={turned ? 79 : 77} y={43} />
    <path d="M60 29q-4-13 11-15 9-6 24 2l3 14-14-1-8-4-13 7z" fill={c.coat} />
    <path d="M57 30q23-6 44 1l-3 5q-24-5-41 0z" fill={c.sleeve} />
    <path d="m87 18 6-11q8 0 10 7l-12 9m4-11 3 3" fill={cream} />
    <circle cx="88" cy="29" r="2.7" fill={gold} />
    {suit === "oros" && <path d="m66 105 8-5 7 5-7 5z" fill={gold} />}
    {suit === "copas" && <path d="m87 104 5-5 5 5-5 5z" fill={gold} />}
    <HeldSuit suit={suit} x={121} y={116} height={78} />
    <path d="m116 111 8-2 3 4-2 7-7 1-4-5z" fill={skin} />
    <path d="m119 112 1 6m3-7-1 6" fill="none" strokeWidth=".75" />
  </g>;
}

function Caballo({ suit, colors: c }: { suit: Suit; colors: Livery }) {
  return <g data-court-body="mounted" data-court-human="rider">
    <Ground suit={suit} />
    <g data-court-horse="true">
      {/* Four distinct legs, a raised neck and a long profile make the mount legible at hand size. */}
      <path d="m112 161 9 18-3 19 15 19-7 6-21-26 1-19-8-10zM54 154l9 23-4 22 12 18-8 5-17-23 3-21-9-17z" fill="#b7a687" />
      <path d="m122 214 11-1 8 8-15 3-3-5ZM60 214l11 0 7 7-15 3-3-5Z" fill="#544332" />
      <path d="M128 141q20-1 23 15l-2 16 7 14q-12-2-17-16l-2-18" fill={c.mane} />
      <path d="m146 151-3 20 7 11m-3-27-1 15" fill="none" stroke="#c79c64" strokeWidth=".8" />
      <path d="M48 145q-1-15 13-24l16 3q23 7 50 9 19 4 17 24-2 17-24 17H66q-24-4-18-29z" fill={c.horse} />
      <path d="M61 133q21 10 46 7l22-1m-66 23q23 8 49 5" fill="none" stroke="#ad9872" strokeWidth="1" />
      <path d="M64 151q-7 16-14 26l-3 35-10 9-7-5 7-7 1-37 8-30z" fill={c.horse} />
      <path d="m37 208 10 3-1 9-3 4H28q-1-5 8-10Z" fill="#4f4032" />
      <path d="M127 160q7 12 3 23l-5 17 13 15-8 7-18-20 4-22-6-11" fill={c.horse} />
      <path d="m128 211 10-1 3 7 6 4-17 3-2-5Z" fill="#4f4032" />
      <path d="m43 175 6 2m68 8 9 1" fill="none" stroke="#a68f6a" />
      <path d="M64 137 57 105q-4-16-15-18l-4 18q-7 6-15 20-5 6 0 11 8 7 17-1l7-9 4 24" fill={c.horse} />
      <path d="M43 90 39 78l-5 15-4-10-1 17" fill={c.horse} />
      <path d="m41 86 7 6 8 18 3 22-9 7-2-24-7-14z" fill={c.mane} />
      <path d="m44 93 6 11m-5-4 7 11m-6-4 8 12m-6-2 8 11" fill="none" stroke="#c29a67" strokeWidth="1" />
      <path d="m32 111 6-2m-7 4h2M24 131l7 2" fill="none" strokeWidth="1.7" />
      <path d="M24 124q8 5 16 3m-8-18 12 14 9-9" fill="none" stroke="#9c3b2d" strokeWidth="2.7" />
      <circle cx="41" cy="127" r="2" fill={gold} />
      <path d="M71 126q15 6 39 3l7 24q-18 14-44 1z" fill={c.coat} />
      <path d="m78 132 24 2 4 17q-13 5-27-1z" fill={c.sleeve} />
      <path d="M75 128q13 5 35 3l3 5q-20 5-38-1z" fill="#70472d" />
      <path d="m79 155 6 4m5-2 6 4m6-5 6 3" fill="none" stroke={gold} strokeWidth="2" />
      <path d="m64 140 8 1m-1 9 4 1" fill="none" stroke={gold} strokeWidth="2.5" />
      <path d="M41 127Q60 130 76 100" fill="none" stroke="#71492c" strokeWidth="1.7" />
    </g>
    <path d="m84 111-11 19 12 23 8 21 13-3-10-25-8-14 13-15z" fill={c.hose} />
    <path d="m92 163 13-2 5 16 13 5q4 6-4 7l-22-5-2-13z" fill="#775133" />
    <path d="m98 172 8-2m-7 8 17 6" fill="none" stroke={gold} />
    <path d="m103 176-4 10q4 5 13 1l-1-8" fill="none" stroke="#ac803d" strokeWidth="2" />
    <path d="M85 66q15-6 24 4l-4 42 6 10q-14 10-32 0l5-20z" fill={c.coat} />
    <path d="m85 74 11 10 9-10m-11 12-6 28m9-27 7 27" fill="none" stroke={gold} strokeWidth="2" />
    <path d="M83 69q-9-1-12 10l3 13 10-2 7-15z" fill={c.sleeve} />
    <path d="m76 76 7 7m-8 1 5 4" fill="none" stroke={gold} strokeWidth="2.6" />
    <path d="m75 87-5 12q4 8 12 5l7-7-5-6-6 5 4-8Z" fill={skin} />
    <path d="M107 69q9 2 10 13l-6 9-10-4-1-12z" fill={c.sleeve} />
    <path d="m109 75 4 10m-7-9 3 8" fill="none" stroke={gold} strokeWidth="2.3" />
    <path d="m111 86 13 9-3 13-7-2 1-9-10-5z" fill={c.coat} />
    <Embroidery x={82} y={111} width={25} />
    <path d="m89 64-1 9 10 6 7-8-2-9" fill={skin} />
    <Face x={96} y={46} />
    <path d="M80 34q-1-12 13-14 15-1 19 12l-2 7-8-2-5-8-7 8z" fill={c.sleeve} />
    <path d="M78 35q16-6 36 2l-1 5q-18-5-34-2z" fill={c.coat} />
    <path d="m104 23 6-13q11 1 12 9l-14 11z" fill={cream} />
    <path d="m109 24 8-9" fill="none" stroke="#a1906e" />
    <circle cx="102" cy="36" r="2.4" fill={gold} />
    <HeldSuit suit={suit} x={122} y={104} height={75} />
    <path d="m117 99 8-1 2 5-3 6-7-1-2-4z" fill={skin} />
    <path d="m120 100 1 6m3-6-1 5" fill="none" strokeWidth=".75" />
  </g>;
}

function Rey({ suit, colors: c }: { suit: Suit; colors: Livery }) {
  const silver = suit === "bastos" || suit === "copas";
  return <g data-court-body="royal" data-court-human="king">
    <Ground suit={suit} />
    {/* Open mantle, crown and long embroidered robe: never a numeric suit composition. */}
    <path d="M58 66q-18 6-20 27l-7 105q12 19 38 13l12-39 14 40q28 5 42-15l-13-105q-4-20-22-25z" fill={c.cape} />
    <path d="m46 94-8 97 15 10m64-107 12 95-13 11" fill="none" stroke={gold} strokeWidth="2.2" />
    <path d="M60 68q-11 11-11 28l5 92 16-23 7-87zM100 68q12 10 12 26l2 94-18-24-8-86z" fill={cream} />
    <path d="m54 87 3 2m-4 12 3 2m-2 13 3 2m-2 13 3 2m-1 13 3 2m-1 13 3 2m45-73-3 2m4 12-3 2m4 13-3 2m4 13-3 2m3 13-3 2m3 13-3 2" fill="none" stroke="#675245" strokeWidth="2" />
    <path d="M68 65q12-5 23 0l12 64 5 73q-26 10-54 0l6-73z" fill={c.coat} />
    <path d="m79 80-6 110m11-109 8 109" fill="none" stroke={gold} strokeWidth="2" />
    <path d="m65 94 14 9 15-9m-31 20 15 9 18-9m-19 16-13 9 14 9 17-9z" fill={c.sleeve} />
    <path d="m71 98 8-5 8 5-8 7zm-1 39 8-6 9 6-9 6z" fill={gold} />
    <circle cx="79" cy="99" r="2.4" fill="#b83931" />
    <path d="M61 124h39v7H61z" fill="#705032" />
    <rect x="75" y="123" width="12" height="9" rx="1" fill={gold} />
    <path d="m80 126 3 2-3 2-3-2z" fill={c.sleeve} strokeWidth=".7" />
    <path d="m62 151 3 36m32-36-2 36m-15-32v31" fill="none" stroke={c.dark} strokeWidth="2" />
    <Embroidery x={56} y={193} width={50} />
    <path d="m60 199 16 1-1 24H50q-7-1-3-5l11-5Zm29 1h13l-2 13 10 6q6 5-2 6H87l1-12Z" fill="#754d32" />
    <path d="M52 221h18m20-1h14" fill="none" stroke={gold} />
    <path d="M59 72q-12 0-14 14l7 18 13-5 4-18z" fill={c.sleeve} />
    <path d="m51 80 9 15m-5-18 9 15" fill="none" stroke={gold} strokeWidth="3.3" />
    <path d="m51 101 5 25 12 5 5-8-9-5-1-22z" fill={c.coat} />
    <path d="m67 119 9-1 6 5-5 7-8-1-5-5z" fill={skin} />
    <path d="m71 120 4 5m-1-6 4 4" fill="none" strokeWidth=".7" />
    <path d="M98 72q13-1 17 12l-6 18-14-6-5-16z" fill={c.sleeve} />
    <path d="m103 78 6 16m-11-15 6 14" fill="none" stroke={gold} strokeWidth="3" />
    <path d="m107 98 15 11-2 16-10-1 2-12-11-9z" fill={c.coat} />
    <path d="M67 62v12q12 9 23 0V61" fill={skin} />
    <Face x={79} y={44} beard silver={silver} />
    <g data-court-crown="true">
      <path d="m61 26-3-17 11 8 10-12 10 12 11-8-3 17z" fill={gold} />
      <path d="M61 25h36v8H61z" fill="#e4b447" />
      <path d="m65 28 4-2 4 2-4 3zm12 0 3-2 3 2-3 3zm11 0 4-2 3 2-3 3z" fill={c.coat} strokeWidth=".7" />
      <circle cx="58" cy="9" r="2.4" fill={gold} />
      <circle cx="79" cy="5" r="2.5" fill={gold} />
      <circle cx="100" cy="9" r="2.4" fill={gold} />
    </g>
    <path d="M66 72q13 15 26 0" fill="none" stroke={gold} strokeWidth="3" />
    <circle cx="79" cy="81" r="3.5" fill={gold} />
    <path d="m79 78 2 3-2 3-2-3z" fill={c.coat} strokeWidth=".7" />
    <HeldSuit suit={suit} x={122} y={121} height={86} />
    <path d="m117 116 7-1 4 5-3 7-8-1-3-5z" fill={skin} />
    <path d="m119 117 1 7m4-7-2 6" fill="none" strokeWidth=".75" />
  </g>;
}
