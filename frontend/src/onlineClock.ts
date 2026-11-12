import type {OnlineTimerState} from '../../shared/contracts';
type Anchor={receivedAt:number;remaining:number};
const anchors=new WeakMap<OnlineTimerState,Anchor>();
/** Rebase server deadline onto monotonic browser time. Never trust the local calendar clock. */
export function anchorOnlineClock(timer:OnlineTimerState,sentAt:number,receivedAt:number){
 const remaining=Date.parse(timer.deadlineAt)-Date.parse(timer.serverNow);
 anchors.set(timer,{receivedAt,remaining:Math.max(0,remaining-Math.max(0,receivedAt-sentAt)/2)});
}
export function onlineRemainingMs(timer:OnlineTimerState,now=performance.now()):number{
 if(!timer.running)return 0;
 if(!anchors.has(timer))anchorOnlineClock(timer,now,now);
 const anchor=anchors.get(timer)!;
 return Math.max(0,anchor.remaining-Math.max(0,now-anchor.receivedAt));
}
