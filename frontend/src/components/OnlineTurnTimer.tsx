import {useEffect,useState} from 'react';
import type {OnlineTimerState} from '../../../shared/contracts';
import {onlineRemainingMs} from '../onlineClock';
export function OnlineTurnTimer({timer,activeName,onExpired}:{timer:OnlineTimerState;activeName:string;onExpired:(expired:boolean)=>void}){
 const [remaining,setRemaining]=useState(()=>onlineRemainingMs(timer));
 useEffect(()=>{const update=()=>setRemaining(onlineRemainingMs(timer));update();const id=window.setInterval(update,100);document.addEventListener('visibilitychange',update);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',update);};},[timer]);
 const seconds=Math.ceil(remaining/1000),expired=remaining<=0;
 useEffect(()=>{onExpired(expired);},[expired,timer.turnId,onExpired]);
 return <div className={`online-turn-timer ${seconds<=5?'urgent':''} ${expired?'expired':''}`} aria-label={`Tiempo de ${activeName}`}>
  <span>Turno de {activeName}</span><strong data-testid="turn-seconds" aria-label={`${seconds} segundos restantes`}>{seconds}<small>s</small></strong>
  <div className="online-timer-track" role="progressbar" aria-label="Tiempo restante del turno" aria-valuemin={0} aria-valuemax={15} aria-valuenow={seconds}><i style={{width:`${Math.min(100,remaining/(timer.durationSeconds*1000)*100)}%`}}/></div>
  {expired&&<span className="timer-expiry-note" role="status">Tiempo agotado. Esperando confirmación del servidor…</span>}
 </div>;
}
