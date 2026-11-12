import {useState} from 'react';
import type {DuelState} from '../../../shared/contracts';
import {api,request,uncertainFailure} from '../api';
import {cpuClosureMessage} from '../duelLifecycle';
import {useConfirmation} from './Confirmation';
import {Notice} from './GameHeader';

type Pending={expectedVersion:number;requestId:string};
export function CloseDuelButton({id,profileId,online=false,disabled=false,onClosed}:{id:string;profileId:string;online?:boolean;disabled?:boolean;onClosed:()=>void|Promise<void>}){
 const key=`truco-arena:close:${profileId}:${id}`;
 const [pending,setPending]=useState<Pending|null>(()=>{try{const p=JSON.parse(localStorage.getItem(key)??'null');return p&&Number.isSafeInteger(p.expectedVersion)&&typeof p.requestId==='string'?p:null;}catch{return null;}});
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const confirmation=useConfirmation();
 function remember(value:Pending|null){setPending(value);if(value)localStorage.setItem(key,JSON.stringify(value));else localStorage.removeItem(key);}
 async function close(){
  if(busy||disabled)return;
  if(!pending&&!await confirmation.confirm({title:online?'¿Abandonar la partida online?':'¿Cerrar la partida contra CPU?',message:online?'Tu rival ganará por abandono. La partida seguirá en el historial.':cpuClosureMessage,action:online?'Abandonar partida':'Cerrar partida',cancel:'Seguir jugando'}))return;
  setBusy(true);setError('');
  try{
   let input=pending;
   if(!input){const current=await api.duel(id);if(current.status==='finished'){await onClosed();return;}input={expectedVersion:current.version,requestId:crypto.randomUUID()};remember(input);}
   await request<DuelState>(`/duels/${id}/abandon`,{method:'POST',body:JSON.stringify(input)});remember(null);await onClosed();
  }catch(e){
   if(!uncertainFailure(e))remember(null);
   setError((e as Error).message);
  }finally{setBusy(false);}
 }
 return <div className="close-duel-control">{confirmation.dialog}<button className="button secondary" disabled={busy||disabled} onClick={()=>void close()}>{busy?'Cerrando…':pending?'Reintentar cierre pendiente':online?'Abandonar partida':'Cerrar partida'}</button>{error&&<Notice onClose={()=>setError('')}>{error}</Notice>}</div>;
}
