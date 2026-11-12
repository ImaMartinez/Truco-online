import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Card,Deck,DuelState,Player,RoomState} from '../../shared/contracts';
import {api,request} from './api';
import {Collection} from './pages/Collection';
import {Decks} from './pages/Decks';
import {Battlefield} from './pages/Battlefield';
import {Home} from './pages/Home';
import {PlayCpu} from './pages/PlayCpu';
import {OnlineRooms} from './pages/OnlineRooms';
import {Icon} from './components/Icon';
import {useConfirmation} from './components/Confirmation';
import type {RandomDeckDraft} from './randomDeck';

const menu=[['inicio','Inicio','home'],['jugar','Jugar','swords'],['coleccion','Colección','cards'],['mazos','Mis mazos','deck'],['historial','Historial','cards'],['perfil','Mi perfil','help']];
const extraSections:Record<string,string>={multijugador:'Multijugador',sala:'Sala privada'};
type ProfileResult={profile:Player|null;authenticated?:boolean;recoveryCode?:string};
type History={id:string;turn:number;status:string;reason:string|null;startedAt:string;winnerPosition?:number|null;ownPosition?:number;cpuDifficulty?:string}[];
const route=()=>window.location.hash.replace('#/','').split('?')[0]||'inicio';
function RecoveryDialog({code,onClose}:{code:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const [copied,setCopied]=useState(false);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 return createPortal(<dialog ref={dialog} className="confirmation-dialog recovery-dialog" aria-labelledby="recovery-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <span className="eyebrow">SOLO PARA VOS</span><h2 id="recovery-title">Guardá tu código privado</h2>
  <p>Te permite recuperar este perfil en otro navegador. Se muestra una sola vez. El código anterior ya no funciona.</p>
  <output data-testid="recovery-code">{code}</output><p>No lo compartas: quien lo tenga puede acceder a tu perfil.</p>
  <div className="confirmation-actions"><button className="button secondary" onClick={()=>void navigator.clipboard.writeText(code).then(()=>setCopied(true)).catch(()=>setCopied(false))}>{copied?'Copiado':'Copiar código'}</button><button className="button primary" onClick={onClose}>Ya lo guardé</button></div>
 </dialog>,document.body);
}
export function SupabaseWebApp(){
 const [profile,setProfile]=useState<Player|null>(null);const [checking,setChecking]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [page,setPage]=useState(route);const [location,setLocation]=useState(window.location.hash);const [rooms,setRooms]=useState<RoomState[]>([]);const [mode,setMode]=useState<'create'|'recover'>('create');const [alias,setAlias]=useState('');const [inputCode,setInputCode]=useState('');const [secret,setSecret]=useState('');
 const [cards,setCards]=useState<Card[]>([]);const [decks,setDecks]=useState<Deck[]>([]);const [history,setHistory]=useState<History>([]);const [duel,setDuel]=useState<DuelState|null>(null);const [draft,setDraft]=useState<RandomDeckDraft|null>(null);
 const confirmation=useConfirmation();
 useEffect(()=>{let live=true;request<ProfileResult>('/me').then(r=>{if(live)setProfile(r.profile);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setChecking(false);});return()=>{live=false;};},[]);
 useEffect(()=>{const f=()=>{setPage(route());setLocation(window.location.hash);setDuel(null);};window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f);},[]);
 async function load(){const [catalog,list,h,r]=await Promise.all([api.catalog(),api.decks(),request<{duels:History}>('/history'),request<{rooms:RoomState[]}>('/rooms')]);setCards(catalog.cards);setDecks(list.decks);setHistory(h.duels);setRooms(r.rooms);}
 function updateDuel(next:DuelState){setDuel(current=>!current||current.id!==next.id||current.version>next.version?current:next);}
 useEffect(()=>{if(profile)void load().catch(e=>setError(e.message));},[profile?.id]);
 useEffect(()=>{if(profile&&(page==='historial'||page==='jugar'))void load().catch(e=>setError(e.message));},[page]);
 useEffect(()=>{
  const id=new URLSearchParams(location.split('?')[1]??'').get('partida');if(!profile||page!=='arena'||!id)return;
  let live=true;setBusy(true);api.duel(id).then(s=>{if(live)setDuel(s);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};
 },[page,profile?.id,location]);
 async function enter(){
  if(busy)return;setBusy(true);setError('');try{
   const r=await request<ProfileResult>(mode==='create'?'/profile':'/profile/recover',{method:'POST',body:JSON.stringify(mode==='create'?{alias}:{code:inputCode})});
   setProfile(r.profile);setSecret(r.recoveryCode??'');setInputCode('');setAlias('');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo recuperar el perfil.');}finally{setBusy(false);}
 }
 async function rotate(){
  if(!await confirmation.confirm({title:'¿Renovar tu código?',message:'El código anterior dejará de funcionar. Las sesiones que ya estén abiertas seguirán vinculadas a tu perfil.',action:'Generar código nuevo'}))return;
  setBusy(true);setError('');try{const r=await request<ProfileResult>('/profile/rotate',{method:'POST',body:'{}'});setSecret(r.recoveryCode??'');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function logout(){if(!await confirmation.confirm({title:'¿Cerrar esta sesión?',message:'Para volver a entrar necesitarás tu código privado. Comprobá que lo guardaste.',action:'Cerrar sesión'}))return;setBusy(true);try{await request('/session/logout',{method:'POST',body:'{}'});setProfile(null);setCards([]);setDecks([]);setDuel(null);setHistory([]);setSecret('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(checking)return <main className="profile-entry"><p role="status">Recuperando tu sesión…</p></main>;
 if(!profile)return <main className="profile-entry"><section className="profile-card"><span className="eyebrow">TRUCO ARENA</span><h1>Tu lugar en la mesa.</h1><p>Sin correo ni contraseña. Tu perfil, colección y mazos se guardan para la próxima vez.</p>
  <div className="profile-tabs"><button className={`button ${mode==='create'?'primary':'secondary'}`} onClick={()=>setMode('create')}>Crear perfil</button><button className={`button ${mode==='recover'?'primary':'secondary'}`} onClick={()=>setMode('recover')}>Recuperar perfil</button></div>
  <form onSubmit={e=>{e.preventDefault();void enter();}}>{mode==='create'?<label>Tu alias<input autoComplete="nickname" maxLength={40} required value={alias} onChange={e=>setAlias(e.target.value)}/></label>:<label>Código privado de recuperación<input autoComplete="off" type="password" maxLength={64} required value={inputCode} onChange={e=>setInputCode(e.target.value)}/></label>}
   {error&&<p role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy?'Validando…':mode==='create'?'Crear mi perfil':'Recuperar mi perfil'}</button></form>
 </section></main>;
 return <div className={`app-shell supabase-shell ${page==='arena'&&duel?'arena-viewport':''}`}>
  {confirmation.dialog}{secret&&<RecoveryDialog code={secret} onClose={()=>setSecret('')}/>}
  <aside className="app-sidebar"><a className="brand" href="#/inicio"><span className="brand-mark"><Icon name="swords" size={27}/></span><span>TRUCO<strong>ARENA</strong><small>BATALLA DE NAIPES</small></span></a>
   <span className="sidebar-label">TU MESA</span><nav aria-label="Navegación principal">{menu.map(([id,label,icon])=><a key={id} href={`#/${id}`} className={page===id?'active':''} aria-current={page===id?'page':undefined}><Icon name={icon}/><span>{label}</span></a>)}</nav>
   <div className="sidebar-bottom"><a className="demo-profile" href="#/perfil"><span className="profile-avatar">{profile.alias.slice(0,2).toUpperCase()}</span><span><strong>{profile.alias}</strong><small>Mi perfil</small></span></a></div>
  </aside>
  <div className="app-main"><div className="topbar"><span className="topbar-breadcrumb">TRUCO ARENA / {menu.find(m=>m[0]===page)?.[1]??extraSections[page]??'La arena'}</span><span className="demo-badge">Perfil conectado</span></div>
  <main className={`main-content page-${page}`}>{error&&<div className="notice" role="alert">{error}<button className="button secondary small" onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>Volver a consultar</button></div>}
   {page==='inicio'&&cards.length>0&&<Home cards={cards} persistent onPlay={()=>{window.location.hash='/jugar';}}/>}
   {page==='coleccion'&&<Collection remoteProfile cards={cards} persistent players={[profile]} onRandomDraft={d=>{setDraft(d);window.location.hash='/mazos';}}/>}
   {page==='mazos'&&<Decks remoteProfile cards={cards} decks={decks} players={[profile]} persistent initialDraft={draft} onDraftConsumed={()=>setDraft(null)} onSaved={deck=>setDecks(old=>[...old.filter(d=>d.id!==deck.id),deck])} onDeleted={id=>setDecks(old=>old.filter(d=>d.id!==id))}/>}
   {page==='jugar'&&<PlayCpu decks={decks} profileId={profile.id} rooms={rooms} active={history.filter(g=>g.status==='active')} onStarted={game=>{setDuel(game);window.location.hash='/arena?partida='+game.id;}}/>}
   {(page==='multijugador'||page==='sala')&&<OnlineRooms key={`${profile.id}:${location}`} profileId={profile.id} decks={decks} roomId={page==='sala'?new URLSearchParams(location.split('?')[1]??'').get('id')??undefined:undefined} onJoined={id=>{window.location.hash='/arena?partida='+id;}}/>}
   {page==='historial'&&<section><h1>Mi historial</h1><button className="button secondary" onClick={()=>void load().catch(e=>setError(e.message))}>Actualizar historial</button>{!history.length?<p>Todavía no tenés partidas guardadas.</p>:<ul className="profile-history">{history.map(g=><li key={g.id}><strong>Partida #{g.id}</strong><span>Turno {g.turn} · {g.status==='active'?'En curso':g.reason==='REINICIO'?'Reiniciada':g.winnerPosition===null?'Empate':g.winnerPosition===g.ownPosition?'Victoria':'Derrota'}</span>{g.reason==='INACTIVIDAD'&&<span>Por inactividad</span>}{g.reason==='ABANDONO'&&<span>Por abandono</span>}<a className="button secondary" href={`#/arena?partida=${g.id}`}>Ver partida</a></li>)}</ul>}</section>}
   {page==='perfil'&&<section className="profile-card"><h1>Mi perfil</h1><h2>{profile.alias}</h2><p>Tu colección, mazos e historial están vinculados a este perfil.</p><h2>Recuperación</h2><p>El código original no se puede volver a consultar. Podés generar uno nuevo e invalidar el anterior.</p><button className="button primary" disabled={busy} onClick={()=>void rotate()}>Generar código nuevo</button><button className="button secondary" disabled={busy} onClick={()=>void logout()}>Cerrar sesión</button></section>}
   {page==='arena'&&(duel?<Battlefield key={`${duel.id}:${profile.id}`} cards={cards} duel={duel} onUpdate={updateDuel} onReset={()=>{window.location.hash='/jugar';}}/>:<p role="status">{busy?'Recuperando partida…':'Elegí una partida de tu historial.'}</p>)}
  </main></div>
 </div>;
}
