import type { Suit } from '../../../../shared/contracts';
import { SuitEmblem } from './SuitEmblem';

/** Decoration belongs to the ace, not to its count: there is still exactly one central object. */
export function AceIllustration({ suit }: { suit: Suit }) {
  const strong = suit === 'espadas' || suit === 'bastos';
  return <g data-ace-suit={suit} stroke="#75562d" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round">
    {strong && <g data-ace-decoration="rays" stroke="#c99a40" strokeWidth=".65">
      {Array.from({length:20},(_,i)=>{const a=(i*18)*Math.PI/180;return <path key={i} d={`M${80+Math.cos(a)*48} ${96+Math.sin(a)*62}L${80+Math.cos(a)*59} ${96+Math.sin(a)*75}`} />;})}
    </g>}
    <g data-ace-decoration="laurel" fill="#80934c" stroke="#596339" transform={strong?'translate(0 5)':'translate(6 12) scale(.92)'}>
      {[false,true].map(right=><g key={String(right)} transform={right?'translate(160 0) scale(-1 1)':undefined}>
        <path d="M76 202Q22 187 22 132" fill="none" strokeWidth="1.5" />
        {[0,1,2,3,4].map(i=><g key={i} transform={`translate(${26+i*i*1.8} ${143+i*12}) rotate(${-22+i*13})`}>
          <path d="M0 6Q-14 0-10-10Q0-7 0 6Z" />
          <path d="M1 9Q13 4 12-6Q2-3 1 9Z" fill="#a7ad5d" />
          <path d="M0 6-8-7M1 9 10-3" fill="none" strokeWidth=".55" />
        </g>)}
      </g>)}
    </g>
    <g data-central-pip="true" data-pip-index="1" transform={strong?'translate(12 12) scale(1.7 1.9)':suit==='oros'?'translate(-2 12) scale(2.05)':'translate(4 20) scale(1.9)'}>
      <SuitEmblem suit={suit} />
      {suit==='espadas'&&<g fill="none" strokeWidth=".65">
        <path d="M35 19 37 60m4-42 2 43M23 69q-5-10-9-1 0 5 7 4m36-3q5-10 9-1 0 5-7 4" stroke="#8c6a31" />
        <path d="m40 65 5 6-5 5-5-5Z" fill="#ae392c" /><path d="m36 80 8 1m-8 4 8 1" stroke="#ffe6a1" />
      </g>}
      {suit==='bastos'&&<g fill="none" stroke="#eac264" strokeWidth=".9">
        <path d="M38 21q-7 17 2 42m-2-22-9-8m10 19 9-12m-9 21-7-8" />
        <path d="M28 60q15-11 24-5l-1 5q-11-4-22 6Z" fill="#b63e2c" stroke="#efbf4e" />
        <ellipse cx="31" cy="20" rx="2.9" ry="4.7" /><ellipse cx="47" cy="54" rx="3.1" ry="4.5" />
      </g>}
      {suit==='oros'&&<g fill="none" stroke="#a6782c" strokeWidth=".6"><circle cx="40" cy="50" r="31.5" />
        <path d="M30 37q4-15 14-11m-10 6-5-3m7 0-3-4m7 3-1-5m5 6 2-5" stroke="#7d652e" />
      </g>}
      {suit==='copas'&&<g fill="#edc25d" stroke="#8d602b" strokeWidth=".5">
        {[27,53].map(x=><path key={x} d={`M${x} 46q-8-9-3-14 5 3 3 14q5-8 8-4-3 6-8 4Z`} />)}
        <path d="m32 88 8-5 8 5-8 4Z" fill="#32758b" />
      </g>}
    </g>
    <g data-ace-decoration="ribbon" transform={strong?'translate(0 5)':'translate(0 12)'}>
      <path d="m61 198-15 2 4 5-3 6 18-6m34-7 15 2-4 5 3 6-18-6" fill={strong?'#367a8b':'#ad4c32'} />
      <path d="M62 196q18 5 36 0l-1 9q-17-4-34 0Z" fill={strong?'#34758a':'#bd563a'} />
      <path d="M66 199q14 3 28 0m-27 3q13 1 26 0" fill="none" stroke="#edc25d" strokeWidth=".7" />
    </g>
  </g>;
}
