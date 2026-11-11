import type {ActionRequest,DuelState} from '../../shared/contracts';

/** Display confirmed HP changes only. This never computes or applies game damage. */
export async function animateCombat(before:DuelState,after:DuelState,input:ActionRequest,signal:AbortSignal):Promise<void> {
 if(input.action.type!=='attack'||after.operation?.replayed||after.version!==before.version+1||signal.aborted||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const findCard=(id:string)=>[...document.querySelectorAll<HTMLElement>('.battle-table [data-instance-id]')].find(el=>el.dataset.instanceId===id);
 const hero=(id:string)=>[...document.querySelectorAll<HTMLElement>('[data-life-player]')].find(el=>el.dataset.lifePlayer===id)??[...document.querySelectorAll<HTMLElement>('[data-hero-player]')].find(el=>el.dataset.heroPlayer===id)?.querySelector<HTMLElement>('.hero-target');
 const actor=before.players.find(p=>p.id===(input.actorId??before.activePlayerId));
 const rival=before.players.find(p=>p.id!==actor?.id);if(!actor||!rival)return;
 const source=findCard(input.action.attackerId);
 const target=input.action.targetId==='hero'?hero(rival.id):findCard(input.action.targetId);
 if(!source||!target)return;
 const layer=document.createElement('div');layer.className='combat-animation-layer';layer.dataset.combatAnimation='attack';layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);
 const animations:Animation[]=[];const hidden=new Map<HTMLElement,string>();
 const hide=(el:HTMLElement)=>{if(!hidden.has(el))hidden.set(el,el.style.visibility);el.style.visibility='hidden';};
 const run=(el:HTMLElement,frames:Keyframe[],duration:number)=>{
  const animation=el.animate(frames,{duration,easing:'ease-out',fill:'forwards'});animations.push(animation);
  return animation.finished.catch(()=>undefined);
 };
 const clone=(element:HTMLElement,className:string)=>{
  const box=element.getBoundingClientRect(),copy=element.cloneNode(true) as HTMLElement;
  copy.removeAttribute('id');copy.removeAttribute('aria-label');copy.removeAttribute('data-instance-id');copy.classList.add(className);
  Object.assign(copy.style,{position:'absolute',left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`,margin:'0',transform:'none',opacity:'1',visibility:'visible',pointerEvents:'none'});
  layer.append(copy);return copy;
 };
 const abort=()=>{for(const animation of animations)animation.cancel();};signal.addEventListener('abort',abort,{once:true});
 try {
  const from=source.getBoundingClientRect(),to=target.getBoundingClientRect();
  const dx=(to.left+to.width/2-from.left-from.width/2)*.82,dy=(to.top+to.height/2-from.top-from.height/2)*.82;
  const attacker=clone(source,'combat-attacker');hide(source);layer.dataset.combatStage='lunge';
  await run(attacker,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx}px,${dy}px) scale(1.12) rotate(${dx>=0?7:-7}deg)`,filter:'drop-shadow(0 0 16px #efd17e)'}],210);
  if(signal.aborted)return;
  layer.dataset.combatStage='impact';
  const impacts:Promise<unknown>[]=[run(attacker,[{transform:`translate(${dx}px,${dy}px) scale(1.12)`},{transform:'translate(0,0) scale(1)'}],220)];
  const deaths:{element:HTMLElement;id:string}[]=[];
  const flash=(element:HTMLElement,amount:number,id:string)=>{
   const box=element.getBoundingClientRect();const text=document.createElement('span');text.className='combat-damage';text.dataset.damageTarget=id;text.textContent=`−${amount}`;
   Object.assign(text.style,{left:`${box.left+box.width/2}px`,top:`${box.top+box.height*.38}px`});layer.append(text);
   impacts.push(run(text,[{opacity:0,transform:'translate(-50%,12px) scale(.7)'},{opacity:1,transform:'translate(-50%,-12px) scale(1.15)',offset:.25},{opacity:1,transform:'translate(-50%,-34px) scale(1)',offset:.75},{opacity:0,transform:'translate(-50%,-52px) scale(.9)'}],560));
   const visual=element===source?attacker:clone(element,'combat-hit');if(element!==source)hide(element);
   if(element===source)impacts.push(run(visual,[{filter:'brightness(1)'},{filter:'brightness(1.8) drop-shadow(0 0 16px #ff4c3f)',offset:.3},{filter:'brightness(1)'}],410));
   if(element!==source)impacts.push(run(visual,[{filter:'brightness(1)'},{filter:'brightness(1.8) drop-shadow(0 0 16px #ff4c3f)',transform:'translateX(-5px)',offset:.25},{filter:'brightness(1) drop-shadow(0 0 5px #ef584b)',transform:'translateX(4px)',offset:.55},{filter:'brightness(1)',transform:'translateX(0)'}],410));
  };
  for(const previous of before.players){
   const next=after.players.find(p=>p.id===previous.id)!;
   if(next.life<previous.life){const element=hero(previous.id);if(element)flash(element,previous.life-next.life,`hero:${previous.id}`);}
   for(const copy of previous.field){
    const survivor=next.field.find(c=>c.id===copy.id);const finalHealth=survivor?.health??next.discard?.find(c=>c.id===copy.id)?.health??0;
    const element=findCard(copy.id);if(!element)continue;
    if(finalHealth<copy.health)flash(element,copy.health-finalHealth,copy.id);
    if(!survivor)deaths.push({element,id:copy.id});
   }
  }
  await Promise.all(impacts);if(signal.aborted)return;
  const eliminated=new Set(deaths.map(death=>death.element));
  for(const [element,visibility] of hidden)if(!eliminated.has(element)){element.style.visibility=visibility;hidden.delete(element);}
  attacker.remove();layer.querySelectorAll('.combat-hit').forEach(el=>el.remove());
  layer.dataset.combatStage='elimination';
  await Promise.all(deaths.map(({element,id})=>{
   const visual=clone(element,'combat-death');visual.dataset.eliminatedInstance=id;hide(element);
   const label=document.createElement('span');label.className='combat-eliminated-label';label.textContent='ELIMINADA';visual.append(label);
   return run(visual,[{opacity:1,transform:'scale(1)',filter:'brightness(1)'},{opacity:1,transform:'translateY(-10px) rotate(-5deg) scale(1.04)',filter:'brightness(1.3) sepia(.4) drop-shadow(0 0 12px #d76737)',offset:.25},{opacity:0,transform:'translate(45px,85px) rotate(18deg) scale(.3)',filter:'brightness(.3) blur(3px)'}],420);
  }));
 } finally {
  signal.removeEventListener('abort',abort);for(const animation of animations)animation.cancel();
  for(const [element,visibility] of hidden)element.style.visibility=visibility;
  layer.remove();
 }
}
