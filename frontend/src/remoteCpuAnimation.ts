import type {DuelState} from '../../shared/contracts';
import {animateCombat} from './combatAnimation';
/** Choreograph confirmed events only; no energy, HP or zones are computed here. */
export async function animateRemoteCpu(before:DuelState,after:DuelState,signal:AbortSignal){
 if(!before.viewerPlayerId||!(before.cpu||before.room)||signal.aborted||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const rival=before.players.find(p=>p.id!==before.viewerPlayerId)!;
 const seen=new Set(before.history?.map(e=>e.id));const events=after.history?.filter(e=>!seen.has(e.id)&&e.actorId===rival.id)??[];
 const attacks=events.filter(e=>e.type==='attack');
 for(const e of attacks.slice(0,-1)){
  const source=[...document.querySelectorAll<HTMLElement>('.battle-table [data-instance-id]')].find(x=>x.dataset.instanceId===e.instanceId);
  if(!source)continue;
  const anim=source.animate([{transform:'translateY(0)'},{transform:'translateY(35px) scale(1.1)',offset:.45},{transform:'translateY(0)'}],{duration:280});
  const abort=()=>anim.cancel();signal.addEventListener('abort',abort,{once:true});await anim.finished.catch(()=>{});signal.removeEventListener('abort',abort);
 }
 const last=attacks.at(-1);if(last&&!signal.aborted)await animateCombat(before,after,{expectedVersion:before.version,actorId:last.actorId,action:{type:'attack',attackerId:last.instanceId,targetId:last.targetId??'hero'}},signal,{confirmedRemoteBatch:true});
}
export function animateCpuInvocations(before:DuelState,after:DuelState){
 if(!after.viewerPlayerId||!(after.cpu||after.room)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const old=new Set(before.players.flatMap(p=>p.field.map(c=>c.id)));const cpu=after.players.find(p=>p.id!==after.viewerPlayerId);
 for(const copy of cpu?.field??[])if(!old.has(copy.id)){
  const el=[...document.querySelectorAll<HTMLElement>('.enemy-field [data-instance-id]')].find(x=>x.dataset.instanceId===copy.id);
  el?.animate([{opacity:0,transform:'translateY(-70px) rotate(-12deg) scale(.7)'},{opacity:1,transform:'translateY(0) rotate(0) scale(1)'}],{duration:500,easing:'ease-out'});
 }
}
