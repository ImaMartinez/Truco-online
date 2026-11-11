import type {Card,DuelState,DuelAction} from '../../shared/contracts';
export type Difficulty='facil'|'normal'|'dificil';
export interface Opponent { mode:'cpu'|'local'; difficulty:Difficulty; humanId?:string }
export function defaultOpponent():Opponent {
  return {mode:localStorage.getItem('truco-arena:play-mode')==='local'?'local':'cpu',difficulty:'normal'};
}
export function opponentFor(duel:DuelState):Opponent {
 try {const saved=JSON.parse(localStorage.getItem(`truco-arena:opponent:${duel.id}`)??'null');
  if(saved&&['cpu','local'].includes(saved.mode)&&['facil','normal','dificil'].includes(saved.difficulty)&&duel.players.some(p=>p.id===saved.humanId))return saved;
 }catch{/* Use the local default for old matches. */}
 return {...defaultOpponent(),humanId:duel.players[0].id};
}
export function rememberOpponent(duel:DuelState,settings:Opponent) {
 const humanId=duel.players.some(player=>player.id===settings.humanId)?settings.humanId:duel.players[0].id;
 localStorage.setItem(`truco-arena:opponent:${duel.id}`,JSON.stringify({...settings,humanId}));
}

/** Suggestions only: every command is validated by the existing API/SQL. Never examines the human hand. */
export function computerAction(state:DuelState,cards:Card[],difficulty:Difficulty,random=Math.random):DuelAction {
 const actor=state.players.find(p=>p.id===state.activePlayerId)!,rival=state.players.find(p=>p.id!==actor.id)!;
 const map=new Map(cards.map(c=>[c.id,c]));
 const candidates:{action:DuelAction;score:number}[]=[];
 if(actor.field.length<3)for(const copy of actor.hand){const card=map.get(copy.cardId)!;
  if(card.cost<=actor.energy)candidates.push({action:{type:'play',instanceId:copy.id},score:card.attack+card.health-card.cost*.4});
 }
 for(const copy of actor.field){
  if(copy.enteredTurn>=state.turn||copy.lastAttackTurn===state.turn)continue;
  const attack=map.get(copy.cardId)!.attack;
  if(!rival.field.length)candidates.push({action:{type:'attack',attackerId:copy.id,targetId:'hero'},score:attack>=rival.life?10000:30+attack});
  else for(const target of rival.field){const counter=map.get(target.cardId)!.attack;
   candidates.push({action:{type:'attack',attackerId:copy.id,targetId:target.id},score:10+Math.min(attack,target.health)+(attack>=target.health?12:0)+(copy.health>counter?6:-8)});
  }
 }
 if(!candidates.length)return {type:'endTurn'};
 if(difficulty==='facil')return candidates[Math.floor(random()*candidates.length)]!.action;
 if(difficulty==='normal'){
  const attacks=candidates.filter(c=>c.action.type==='attack');const pool=attacks.length?attacks:candidates;
  return pool[Math.floor(random()*pool.length)]!.action;
 }
 candidates.sort((a,b)=>b.score-a.score);return candidates[0]!.action;
}
