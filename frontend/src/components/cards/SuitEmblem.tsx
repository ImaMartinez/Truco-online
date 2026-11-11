import type { Suit } from "../../../../shared/contracts";

/** Original line illustrations. Geometry is shared by corners, pips and court accessories. */
export function SuitEmblem({ suit }: { suit: Suit }) {
  return (
    <g data-emblem-suit={suit} stroke="#46372b" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
      {suit === "espadas" && (
        <>
          <path d="M40 3 49 17 46 66 40 73 34 66 31 17Z" fill="#85b8cd" />
          <path d="M40 5v63l-5-5-2-45Z" fill="#e5eee9" stroke="none" />
          <path d="m40 9 6 11-2 40-4 8" fill="none" stroke="#407593" strokeWidth="1" />
          <path d="M32 66h16l2 8H30Z" fill="#d84d36" />
          <path d="M13 69q4-8 10-5l5 6h24l5-6q6-3 10 5l-3 6-10-1H26l-10 1Z" fill="#edbb4b" />
          <path d="m18 69 7 3m30 0 7-3M29 70h22" fill="none" stroke="#fff0a4" strokeWidth="1.5" />
          <path d="M35 76h10l-1 14h-8Z" fill="#c84332" />
          <path d="m35 79 10 3m-10 2 10 3" fill="none" stroke="#f3c154" />
          <path d="m40 88 7 5-3 4h-8l-3-4Z" fill="#e9b744" />
          <circle cx="40" cy="93" r="1.8" fill="#bf382c" stroke="none" />
        </>
      )}
      {suit === "bastos" && (
        <>
          <path d="m33 94-4-18-5-3 2-9-4-7 2-9-5-9 3-7-5-10 4-10 9-6 10 1 6-3 11 8 4 11-3 9 3 8-6 9 1 10-5 8 1 9-5 7-1 11Z" fill="#63834b" />
          <path d="m34 92-3-22-3-17 2-14-5-17 6-10 9 1-4 14 5 14-5 17 5 17-1 18Z" fill="#b8a653" stroke="none" />
          <path d="m41 11 6 13-4 13 5 15-6 17 3 12-4 12" fill="none" stroke="#344f37" strokeWidth="2" />
          <path d="m23 25 10 4m-8 18 10-3m-7 18 10 3m3-43 11-4m-7 25 9 2m-13 20 8-3" fill="none" stroke="#e5c36b" strokeWidth="1.5" />
          <path d="m23 31-10-7 1 11 10 6m30 6 12-10-1 12-11 7" fill="#3d7145" />
          <path d="m17 29 6 9m39 5-9 9" fill="none" stroke="#d5b85f" />
          <path d="m29 73 20-3 1 7-19 4Z" fill="#bf4635" />
          <path d="m32 79 15-3" stroke="#efc057" fill="none" />
          <path d="m35 86 9-1m-8 5 7-1" fill="none" stroke="#6e5633" />
          <ellipse cx="31" cy="20" rx="2.2" ry="4" fill="#a06e37" />
          <ellipse cx="47" cy="54" rx="2.5" ry="4" fill="#bb8b43" />
        </>
      )}
      {suit === "oros" && (
        <>
          <circle cx="40" cy="50" r="33" fill="#e9ae35" />
          <circle cx="40" cy="50" r="29.3" fill="#f4d16b" strokeWidth="1.1" />
          <circle cx="40" cy="50" r="25.6" fill="#e9bd4f" stroke="#8e672e" strokeWidth=".9" />
          <path d="M30 70q-2-9 8-11v-5q-4-2-5-7l-2-3 2-3q-1-11 8-12 11 1 10 12l3 5-5 3-1 9q-1 4-5 4l-1 4 10 5Z" fill="#f9df8d" />
          <path d="m34 37 5-6 9 2 3 6-7-1-3 4-7-1m9 9h5m-8-7 2 1m-5 14 6 3m-8 7 5-3 7 4" fill="none" stroke="#87602d" strokeWidth="1.2" />
          <path d="m19 43-2 8 3 8m41-16 2 8-3 8M34 23h12M34 77h12" fill="none" stroke="#fff0ac" strokeWidth="1.5" />
          {Array.from({ length: 16 }, (_, i) => {
            const angle=(i * Math.PI * 2)/16;
            return <circle key={i} cx={40 + Math.sin(angle) * 27.4} cy={50 + Math.cos(angle) * 27.4} r=".8" fill="#81572b" stroke="none" />;
          })}
        </>
      )}
      {suit === "copas" && (
        <>
          <path d="M16 23q-10 2-7 14 1 12 17 15m38-29q10 2 7 14-1 12-17 15" fill="none" stroke="#d89d35" strokeWidth="5" />
          <path d="M16 23q-10 2-7 14 1 12 17 15m38-29q10 2 7 14-1 12-17 15" fill="none" strokeWidth="1" />
          <path d="M14 18h52l-5 23q-3 19-21 23-18-4-21-23Z" fill="#c83d31" />
          <path d="m20 23 5 20q3 10 10 14l-3-33Zm25 1-3 34q11-6 13-17l4-17Z" fill="#e96841" stroke="none" />
          <path d="m14 18 2 9h48l2-9Z" fill="#edbf52" />
          <ellipse cx="40" cy="17" rx="26" ry="6" fill="#f5d77b" />
          <ellipse cx="40" cy="17" rx="19" ry="2.6" fill="#a34c2c" strokeWidth=".9" />
          <path d="M22 37h36M26 49h28" fill="none" stroke="#f2c768" strokeWidth="2.2" />
          <path d="m40 29 5 8-5 8-5-8Z" fill="#315c86" />
          <path d="M34 62h12l-2 15 13 10H23l13-10Z" fill="#e4ad3f" />
          <path d="m38 65 1 12-8 6h17" fill="none" stroke="#fff0a7" />
          <path d="M20 87h40l3 7H17Z" fill="#c74430" />
          <path d="M21 91h38" fill="none" stroke="#efc764" strokeWidth="2" />
        </>
      )}
    </g>
  );
}
