import {CardBack} from './Card';

export function DrawPile({playerId,count,name,rival=false}:{playerId:string;count:number;name:string;rival?:boolean}){
 return <div className={`draw-pile ${count===0?'is-empty':''} ${rival?'rival-draw-pile':''}`} data-draw-pile={playerId} role="img" aria-label={`Mazo de ${name}: ${count} cartas por robar`}>
  <div className="draw-pile-stack" aria-hidden="true">{count>0?<CardBack small/>:<span>∅</span>}</div>
  <strong aria-hidden="true">{count}</strong><span aria-hidden="true">{count?'por robar':'Sin cartas'}</span>
 </div>;
}
