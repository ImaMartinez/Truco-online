import type {Card,DuelAction} from '../../../shared/contracts.js';
import type {PrivateGame} from '../repositories/postgres-engine.js';
export type CpuDifficulty='facil'|'normal'|'dificil';
type Unit={id:string;attack:number;health:number;cost:number;ready:boolean};
type Position={life:number;enemyLife:number;energy:number;hand:Unit[];field:Unit[];enemy:Unit[]};
/** Heuristic search positions only; SQL remains the sole authority for committed effects. */
function position(game:PrivateGame,cards:Card[]):Position{
 const own=game.players.find(p=>p.id===game.viewerPlayerId)!;
 const enemy=game.players.find(p=>p.id!==game.viewerPlayerId)!;
 const map=new Map(cards.map(c=>[c.id,c]));
 const unit=(c:typeof own.cards[number]):Unit=>{const card=map.get(c.cardId)!;return {id:c.id,attack:card.attack,health:c.health??card.health,cost:card.cost,ready:c.enteredTurn!==null&&c.enteredTurn<game.turn&&c.lastAttackTurn!==game.turn};};
 return {life:own.life,enemyLife:enemy.life,energy:own.energy,hand:own.cards.filter(c=>c.zone==='MANO').map(unit),field:own.cards.filter(c=>c.zone==='CAMPO').map(unit),enemy:enemy.cards.filter(c=>c.zone==='CAMPO').map(unit)};
}
function legal(s:Position):DuelAction[]{
 const actions:DuelAction[]=[];
 if(s.field.length<3)for(const c of s.hand)if(c.cost<=s.energy)actions.push({type:'play',instanceId:c.id});
 for(const c of s.field)if(c.ready){if(!s.enemy.length)actions.push({type:'attack',attackerId:c.id,targetId:'hero'});else for(const t of s.enemy)actions.push({type:'attack',attackerId:c.id,targetId:t.id});}
 return [...actions,{type:'endTurn'}];
}
function predict(s:Position,a:DuelAction):Position{
 const p=structuredClone(s);if(a.type==='play'){const c=p.hand.find(c=>c.id===a.instanceId)!;p.energy-=c.cost;p.hand=p.hand.filter(x=>x.id!==c.id);p.field.push({...c,ready:false});}
 if(a.type==='attack'){const c=p.field.find(c=>c.id===a.attackerId)!;c.ready=false;
  if(a.targetId==='hero')p.enemyLife=Math.max(0,p.enemyLife-c.attack);
  else{const t=p.enemy.find(c=>c.id===a.targetId)!;const hp=c.health-t.attack;t.health-=c.attack;c.health=hp;p.enemy=p.enemy.filter(x=>x.health>0);p.field=p.field.filter(x=>x.health>0);}
 }return p;
}
function value(s:Position){
 if(s.enemyLife===0)return 100000;
 const material=(c:Unit)=>c.attack*2.2+c.health*1.3+c.cost*.35;
 const threat=s.enemy.reduce((n,c)=>n+c.attack,0);
 return (s.life-s.enemyLife)*5+s.field.reduce((n,c)=>n+material(c),0)-s.enemy.reduce((n,c)=>n+material(c),0)+s.hand.reduce((n,c)=>n+material(c)*.18,0)+s.energy*.05-(s.field.length?0:threat*2);
}
export function cpuRandom(gameId:string,version:number):()=>number{
 let seed=version|0;for(const c of gameId)seed=Math.imul(seed^c.charCodeAt(0),16777619);
 return ()=>{seed+=0x6D2B79F5;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};
}
/** Only own hand and public cards are read; no opponent's hand/deck order is available. */
export function decideCpu(game:PrivateGame,cards:Card[],difficulty:CpuDifficulty,random=cpuRandom(game.id,game.version)):DuelAction{
 const s=position(game,cards);const actions=legal(s);const moves=actions.filter(a=>a.type!=='endTurn');if(!moves.length)return {type:'endTurn'};
 if(difficulty==='facil'){if(random()<.18)return {type:'endTurn'};return moves[Math.min(moves.length-1,Math.floor(random()*moves.length))]!;}
 const lethal=moves.find(a=>a.type==='attack'&&a.targetId==='hero'&&s.field.find(c=>c.id===a.attackerId)!.attack>=s.enemyLife);
 if(lethal)return lethal;
 if(difficulty==='normal')return actions.map(a=>({a,score:value(predict(s,a))+(a.type==='play'?1:0)})).sort((a,b)=>b.score-a.score)[0]!.a;
 type Node={p:Position;first:DuelAction;score:number;done:boolean};
 let beam:Node[]=actions.map(a=>{const p=predict(s,a);return {p,first:a,score:value(p),done:a.type==='endTurn'||p.enemyLife===0};});
 let best=beam.reduce((a,b)=>b.score>a.score?b:a);
 for(let depth=1;depth<4;depth++){
  beam.sort((a,b)=>b.score-a.score);const next:Node[]=[];
  for(const node of beam.slice(0,8)){
   if(node.done){next.push(node);continue;}
   for(const a of legal(node.p)){const p=predict(node.p,a);next.push({p,first:node.first,score:value(p),done:a.type==='endTurn'||p.enemyLife===0});}
  }
  beam=next;for(const node of beam)if(node.score>best.score)best=node;
 }
 return best.first;
}
