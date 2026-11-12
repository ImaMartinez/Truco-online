import {useState} from 'react';
import type {Deck,DuelState,RoomState} from '../../../shared/contracts';
import {request,uncertainFailure} from '../api';
import {useConfirmation} from '../components/Confirmation';
type Start={deckId:string;difficulty:'facil'|'normal'|'dificil';requestId:string;replaceActive:boolean};
export function PlayCpu({decks,profileId,active,rooms=[],onStarted}:{decks:Deck[];profileId:string;active:{id:string}[];rooms?:RoomState[];onStarted:(game:DuelState)=>void}){
 const valid=decks.filter(d=>[12,20].includes(d.entries.reduce((n,e)=>n+e.quantity,0)));
 const onlineBusy=rooms.some(r=>r.status==='ESPERANDO'||r.status==='EN_CURSO');
 const [deckId,setDeckId]=useState(valid[0]?.id??'');const [difficulty,setDifficulty]=useState<Start['difficulty']>('normal');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const confirm=useConfirmation();
 const key=`truco-arena:cpu-start:${profileId}`;
 const [pending,setPending]=useState<Start|null>(()=>{try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}});
 async function start(retry=false){
  if(busy)return;setError('');
  if(onlineBusy&&!pending){setError('Primero continuá tu partida online o cancelá la sala de espera.');return;}
  let input=pending;
  if(!input){
   if(active.length&&!await confirm.confirm({title:'¿Empezar otra partida?',message:'Tu partida activa se cerrará como reiniciada, conservando su historial. No contará como victoria ni derrota.',action:'Empezar de cero'}))return;
   input={deckId,difficulty,requestId:crypto.randomUUID(),replaceActive:active.length>0};setPending(input);localStorage.setItem(key,JSON.stringify(input));
  }else if(!retry){setError('Reintentá el inicio pendiente para no duplicar la partida.');return;}
  setBusy(true);
  try{const game=await request<DuelState>('/duels',{method:'POST',body:JSON.stringify(input)});localStorage.removeItem(key);setPending(null);onStarted(game);}
  catch(e){if(!uncertainFailure(e)){localStorage.removeItem(key);setPending(null);}setError((e as Error).message);}
  finally{setBusy(false);}
 }
 return <section><span className="eyebrow">ELEGÍ TU DESAFÍO</span><h1>Jugar</h1>{confirm.dialog}
  <div className="future-modes"><article className="profile-card"><h2>Contra la computadora</h2><p>Elegí tu estrategia. La CPU prepara un mazo independiente del mismo tamaño que el tuyo.</p>
   <div className="play-settings"><label>Tu mazo<select aria-label="Tu mazo" value={deckId} disabled={busy||!!pending} onChange={e=>setDeckId(e.target.value)}><option value="">Elegí un mazo</option>{valid.map(d=><option value={d.id} key={d.id}>{d.name} · {d.entries.reduce((n,e)=>n+e.quantity,0)} cartas</option>)}</select></label>
   <label>Dificultad<select aria-label="Dificultad" value={difficulty} disabled={busy||!!pending} onChange={e=>setDifficulty(e.target.value as Start['difficulty'])}><option value="facil">Fácil</option><option value="normal">Normal</option><option value="dificil">Difícil</option></select></label></div>
   {!!active.length&&<div><p>Tenés una partida en curso.</p>{active.map(g=><a className="button secondary" key={g.id} href={`#/arena?partida=${g.id}`}>Continuar partida #{g.id}</a>)}</div>}
   {onlineBusy&&<p>Tenés una sala o partida online activa. Continuá desde Multijugador; podés cancelar la sala mientras espera un invitado.</p>}
   {error&&<p role="alert">{error}</p>}{pending?<button className="button primary" disabled={busy} onClick={()=>void start(true)}>{busy?'Confirmando…':'Reintentar inicio pendiente'}</button>:<button className="button primary" disabled={busy||!valid.some(d=>d.id===deckId)} onClick={()=>void start()}>{busy?'Preparando la mesa…':'Iniciar partida'}</button>}
   {!valid.length&&<p>Guardá un mazo completo de 12 o 20 cartas para jugar.</p>}
  </article><article className="profile-card"><h2>Multijugador online</h2><p>Invitá a otra persona a una sala privada o uníte con su código.</p><a className="button primary" href="#/multijugador">Multijugador</a>{rooms.map(r=><a className="button secondary" key={r.id} href={r.duelId?`#/arena?partida=${r.duelId}`:`#/sala?id=${r.id}`}>{r.duelId?'Continuar partida online':'Volver a tu sala'} · {r.code}</a>)}</article></div>
  <a className="button secondary" href="#/mazos">Preparar mis mazos</a>
 </section>;
}
