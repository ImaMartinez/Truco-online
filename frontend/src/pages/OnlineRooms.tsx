import {useEffect,useRef,useState} from 'react';
import type {Deck,RoomState,RoomPreview} from '../../../shared/contracts';
import {request,uncertainFailure} from '../api';
import {useConfirmation} from '../components/Confirmation';
type Pending={kind:'create'|'join';requestId:string;deckId:string;code?:string};
export function OnlineRooms({profileId,decks,roomId,onJoined}:{profileId:string;decks:Deck[];roomId?:string;onJoined:(id:string)=>void}){
 const [tab,setTab]=useState<'create'|'join'>('create'),[deckId,setDeckId]=useState(''),[code,setCode]=useState('');
 const [preview,setPreview]=useState<RoomPreview|null>(null),[room,setRoom]=useState<RoomState|null>(null),[rooms,setRooms]=useState<RoomState[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[connected,setConnected]=useState(false),[copied,setCopied]=useState(false);
 const confirm=useConfirmation(),joined=useRef(false);const key=`truco-arena:room-operation:${profileId}`;
 function updateRoom(next:RoomState){setRoom(old=>old&&old.id===next.id&&old.status!=='ESPERANDO'&&next.status==='ESPERANDO'?old:next);}
 const [pending,setPending]=useState<Pending|null>(()=>{try{const p=JSON.parse(localStorage.getItem(key)??'null');return p&&['create','join'].includes(p.kind)&&typeof p.requestId==='string'&&typeof p.deckId==='string'?p:null;}catch{return null;}});
 const valid=decks.filter(d=>[12,20].includes(d.entries.reduce((n,e)=>n+e.quantity,0)));
 const choices=tab==='join'&&preview?valid.filter(d=>d.entries.reduce((n,e)=>n+e.quantity,0)===preview.deckSize):valid;
 useEffect(()=>{
  let disposed=false,timer:ReturnType<typeof setTimeout>;let controller=new AbortController();
  async function poll(){
   controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    if(roomId){const next=await request<RoomState>(`/rooms/${encodeURIComponent(roomId)}`,{signal:controller.signal});if(disposed)return;updateRoom(next);setConnected(true);
     if(next.status==='EN_CURSO'&&next.duelId&&!joined.current){joined.current=true;onJoined(next.duelId);return;}
     if(['CANCELADA','EXPIRADA','FINALIZADA'].includes(next.status))return;
    }else{const next=await request<{rooms:RoomState[]}>('/rooms',{signal:controller.signal});if(disposed)return;setRooms(next.rooms);setConnected(true);}
   }catch(e){if(!disposed){setConnected(false);const status=(e as {status?:number}).status;if(!roomId||status===403||status===404)setError((e as Error).message);if(status===403||status===404)return;}}
   finally{clearTimeout(timeout);}
   if(!disposed)timer=setTimeout(()=>void poll(),1500);
  }
  void poll();return()=>{disposed=true;controller.abort();clearTimeout(timer);};
 },[roomId,profileId]);
 async function submit(retry=false){
  if(busy)return;setError('');let input=pending;
  if(!input){input={kind:tab,deckId,requestId:crypto.randomUUID(),...(tab==='join'?{code:preview?.code??code}:{})};setPending(input);localStorage.setItem(key,JSON.stringify(input));}
  else if(!retry){setError('Reintentá primero la operación pendiente para no duplicarla.');return;}
  setBusy(true);
  try{const next=await request<RoomState>(input.kind==='create'?'/rooms':'/rooms/join',{method:'POST',body:JSON.stringify(input)});localStorage.removeItem(key);setPending(null);
   if(next.status==='EN_CURSO'&&next.duelId)onJoined(next.duelId);else window.location.hash='/sala?id='+next.id;
  }catch(e){if(!uncertainFailure(e)&&(e as {status?:number}).status!==429){localStorage.removeItem(key);setPending(null);}setError((e as Error).message);}finally{setBusy(false);}
 }
 async function lookup(){if(busy)return;setBusy(true);setError('');setPreview(null);try{const p=await request<RoomPreview>('/rooms/lookup',{method:'POST',body:JSON.stringify({code})});setPreview(p);setDeckId('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function cancel(){if(!room||busy||!await confirm.confirm({title:'¿Cancelar la sala?',message:'El código dejará de admitir invitados. No se creará una partida.',action:'Cancelar sala'}))return;setBusy(true);setError('');try{updateRoom(await request<RoomState>(`/rooms/${room.id}/cancel`,{method:'POST',body:'{}'}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 function picker(label:string){return <label>{label}<select aria-label={label} value={deckId} disabled={busy||!!pending} onChange={e=>setDeckId(e.target.value)}><option value="">Elegí un mazo</option>{choices.map(d=><option key={d.id} value={d.id}>{d.name} · {d.entries.reduce((n,e)=>n+e.quantity,0)} cartas</option>)}</select></label>;}
 return <section className="online-rooms"><span className="eyebrow">UNA MESA PARA DOS</span><h1>{roomId?'Sala privada':'Multijugador'}</h1>{confirm.dialog}
  {error&&<p className="notice" role="alert">{error}</p>}
  {roomId?<article className="profile-card room-lobby">
   {!room?<p role="status">{connected?'Recuperando sala…':'Conectando con tu sala… Se reintentará automáticamente.'}</p>:<>
    <p className={`room-connection ${connected?'connected':''}`} role="status">{connected?'Conectado a la sala':'Conexión interrumpida. Reintentando…'}</p>
    <h2>{room.host.alias}</h2><p>Mazo: <strong>{room.host.deckName}</strong> · {room.host.deckSize} cartas</p>
    <span className="eyebrow">CÓDIGO DE INVITACIÓN</span><output className="room-code" data-testid="room-code">{room.code}</output>
    <button className="button secondary" onClick={()=>void navigator.clipboard.writeText(room.code).then(()=>setCopied(true)).catch(()=>setError('No se pudo copiar automáticamente. Seleccioná el código para copiarlo.'))}>{copied?'Código copiado':'Copiar código'}</button>
    {room.status==='ESPERANDO'?<><div className="waiting-rival"><span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span><p role="status">Esperando al segundo jugador...</p></div><p>Compartí el código con tu rival. Vence a las {new Date(room.expiresAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.</p><button className="button secondary" disabled={busy} onClick={()=>void cancel()}>Cancelar sala</button></>:room.status==='EXPIRADA'?<p role="status">La sala expiró. Podés crear otra con un código nuevo.</p>:room.status==='CANCELADA'?<p role="status">El anfitrión canceló esta sala. El código ya no está disponible.</p>:room.status==='FINALIZADA'?<><p>La partida ya terminó. Su historial se conserva.</p><a className="button secondary" href={`#/arena?partida=${room.duelId}`}>Ver partida</a></>:<p role="status">El jugador 2 se unió. Comienza la partida.</p>}
    {['EXPIRADA','CANCELADA'].includes(room.status)&&<a className="button primary" href="#/multijugador">Crear otra sala</a>}
   </>}
  </article>:<>
   {!!rooms.length&&<div className="room-resume">{rooms.map(r=><a className="button secondary" key={r.id} href={r.duelId?`#/arena?partida=${r.duelId}`:`#/sala?id=${r.id}`}>{r.duelId?'Continuar partida':'Volver a tu sala'} · {r.code}</a>)}</div>}
   <div className="profile-tabs" aria-label="Opciones multijugador"><button className={`button ${tab==='create'?'primary':'secondary'}`} disabled={busy||!!pending} onClick={()=>{setTab('create');setDeckId('');setError('');}}>Crear sala</button><button className={`button ${tab==='join'?'primary':'secondary'}`} disabled={busy||!!pending} onClick={()=>{setTab('join');setDeckId('');setError('');}}>Unirse a partida</button></div>
   <article className="profile-card room-form">{pending?<><p>Hay una operación sin respuesta confirmada. El reintento conserva la misma clave.</p><button className="button primary" disabled={busy} onClick={()=>void submit(true)}>Reintentar operación pendiente</button></>:tab==='create'?<><h2>Prepará tu sala</h2>{picker('Tu mazo para la sala')}<p>El anfitrión juega primero. Tu rival necesitará un mazo del mismo tamaño. El código de espera dura 15 minutos.</p><button className="button primary" disabled={busy||!choices.some(d=>d.id===deckId)} onClick={()=>void submit()}>Crear sala privada</button></>:<><h2>Buscá la mesa de tu rival</h2><label>Código de sala<input autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={busy} maxLength={20} value={code} placeholder="ABCD-EFGH" onChange={e=>{setCode(e.target.value.toUpperCase());setPreview(null);}}/></label><button className="button secondary" disabled={busy||!code.trim()} onClick={()=>void lookup()}>Buscar sala</button>
    {preview&&<><p>Anfitrión: <strong>{preview.hostAlias}</strong> · {preview.deckSize} cartas</p>{picker('Tu mazo para unirte')}{!choices.length&&<p>Necesitás preparar un mazo de {preview.deckSize} cartas para esta sala.</p>}<button className="button primary" disabled={busy||!choices.some(d=>d.id===deckId)} onClick={()=>void submit()}>Unirme a esta partida</button></>}
   </>}</article>
  </>}
  <a className="button secondary" href="#/jugar">Volver a Jugar</a>
 </section>;
}
