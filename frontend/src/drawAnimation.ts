import type {ActionRequest,DuelState} from '../../shared/contracts';

/** Only presents a confirmed draw; the API/SQL remains responsible for the card and count. */
export async function animateDraw(before:DuelState,after:DuelState,input:ActionRequest,signal:AbortSignal){
 if(input.action.type!=='endTurn'||after.operation?.replayed||after.version!==before.version+1||signal.aborted||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 for(const player of after.players){
  const previous=before.players.find(p=>p.id===player.id);
  if(!previous||player.deckCount>=previous.deckCount||!player.hand.some(copy=>!previous.hand.some(old=>old.id===copy.id)))continue;
  const pile=[...document.querySelectorAll<HTMLElement>('[data-draw-pile]')].find(el=>el.dataset.drawPile===player.id);
  const source=pile?.querySelector<HTMLElement>('.card-back');
  const hand=[...document.querySelectorAll<HTMLElement>('[data-player-hand]')].find(el=>el.dataset.playerHand===player.id);
  const destination=hand&&hand.getBoundingClientRect().height>0?hand:undefined;
  if(!source||!destination)continue;
  const from=source.getBoundingClientRect(),to=destination.getBoundingClientRect();
  const layer=document.createElement('div');layer.className='draw-animation-layer';layer.dataset.drawPlayer=player.id;layer.setAttribute('aria-hidden','true');layer.inert=true;
  const card=source.cloneNode(true) as HTMLElement;
  Object.assign(card.style,{position:'absolute',left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`,margin:'0',transform:'none'});
  layer.append(card);document.body.append(layer);
  const dx=to.left+to.width*.65-from.left-from.width/2,dy=to.top+to.height/2-from.top-from.height/2;
  const animation=card.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${dx*.5}px,${dy*.5-22}px) rotate(-12deg) scale(1.2)`,opacity:1,offset:.55},{transform:`translate(${dx}px,${dy}px) rotate(0)`,opacity:0}],{duration:520,easing:'ease-in-out'});
  const cancel=()=>animation.cancel();signal.addEventListener('abort',cancel,{once:true});
  try{await animation.finished.catch(()=>undefined);}finally{signal.removeEventListener('abort',cancel);animation.cancel();layer.remove();}
 }
}
