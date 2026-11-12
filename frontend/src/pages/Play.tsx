import {useEffect,useState} from 'react';
import type {Deck,Player,ActiveDuel,Card} from '../../../shared/contracts';
import {PlayerOptions} from '../components/PlayerOptions';
import {GameHeader,Notice} from '../components/GameHeader';
import {defaultOpponent,type Opponent,type Difficulty} from '../computer';
import {DECK_SIZE,isPlayableDeckSize} from '../../../shared/deck-rules';
import {api} from '../api';
import {useConfirmation} from '../components/Confirmation';
import {randomDeck} from '../randomDeck';
import {COMPUTER_DECK_DESCRIPTION} from '../deckDirectory';
const size=(deck:Deck)=>deck.entries.reduce((n,e)=>n+e.quantity,0);
const preferred=(decks:Deck[])=>decks.find(d=>size(d)===DECK_SIZE)?.id??decks[0]?.id??'';

export function Play({players,decks,cards,persistent,onPlay}:{players:Player[];decks:Deck[];cards:Card[];persistent:boolean;onPlay:(ids:[string,string],owners:[string,string]|undefined,settings:Opponent,replaceActive?:boolean)=>Promise<void>}){
 const [human,setHuman]=useState(players[0]?.id??'');const [rival,setRival]=useState(players[1]?.id??'');
 const [settings,setSettings]=useState<Opponent>(defaultOpponent);
 const [active,setActive]=useState<ActiveDuel[]>([]);const [checking,setChecking]=useState(false);const [lookupError,setLookupError]=useState('');
 const [refresh,setRefresh]=useState(0);const confirmation=useConfirmation();
 const [preparing,setPreparing]=useState(false);const [prepareError,setPrepareError]=useState('');
 const cpu=settings.mode==='cpu';
 useEffect(()=>{
  if(!persistent||!human||!rival){setActive([]);return;}
  let ignore=false;setChecking(true);setActive([]);setLookupError('');
  Promise.all([...new Set([human,rival])].map(id=>api.activeDuels(id))).then(lists=>{if(!ignore)setActive([...new Map(lists.flatMap(list=>list.duels).map(duel=>[duel.id,duel])).values()]);})
   .catch(()=>{if(!ignore)setLookupError('No se pudieron consultar las partidas activas.');}).finally(()=>{if(!ignore)setChecking(false);});
  return()=>{ignore=true;};
 },[persistent,human,rival,refresh]);
 const own=persistent?decks.filter(d=>d.ownerId===human):decks;
 const other=persistent?decks.filter(d=>d.ownerId===rival):decks;
 const [first,setFirst]=useState(()=>preferred(own));const [second,setSecond]=useState(()=>preferred(other));
 useEffect(()=>{if(!own.some(d=>d.id===first))setFirst(preferred(own));if(!other.some(d=>d.id===second))setSecond(preferred(other));},[decks,human,rival,first,second]);
 const count=(id:string)=>decks.find(d=>d.id===id)?.entries.reduce((n,e)=>n+e.quantity,0)??0;
 const full=(id:string)=>isPlayableDeckSize(count(id));
 async function begin(){
  if(preparing)return;
  setPreparing(true);setPrepareError('');
  try{
   if(active.length&&!await confirmation.confirm({title:'¿Empezar de cero?',message:`Se cerrarán las partidas activas ${active.map(game=>`#${game.id}`).join(', ')} de estos perfiles, conservando su historial. No se contará una victoria ni un empate.`,action:'Empezar de cero'}))return;
   let rivalDeck=second;
   if(cpu){
    const collection=persistent?(await api.collection(rival)).cards:cards;
    const quantities=persistent?Object.fromEntries(collection.map(card=>[card.id,'quantity' in card?Number(card.quantity):0])):undefined;
    const generated=await api.saveDeck({name:`PC · ${crypto.randomUUID()}`,description:COMPUTER_DECK_DESCRIPTION,entries:randomDeck(collection,quantities),...(persistent?{ownerId:rival}:{})});
    rivalDeck=generated.id;
   }
   await onPlay([first,rivalDeck],persistent?[human,rival]:undefined,{...settings,humanId:persistent?human:undefined},active.length>0);
  }catch(error){setPrepareError(error instanceof Error?error.message:'No se pudo preparar el mazo de la PC.');}
  finally{setPreparing(false);}
 }
 return <section className="play-screen"><GameHeader title="Jugar" eyebrow="ELEGÍ TU DESAFÍO" subtitle="Prepará la mesa y enfrentá a la computadora."/>
 {confirmation.dialog}
 <div className={`play-settings ${cpu?'play-settings-cpu':''}`}><label>Modo de juego<select aria-label="Modo de juego" value={settings.mode} onChange={e=>{const mode=e.target.value as Opponent['mode'];setSettings({...settings,mode});localStorage.setItem('truco-arena:play-mode',mode);}}><option value="cpu">Contra la computadora</option><option value="local">Dos personas · mismo dispositivo</option></select></label>
 {persistent&&<label>Jugador 1<select aria-label="Jugador 1" value={human} onChange={e=>setHuman(e.target.value)}><PlayerOptions players={players}/></select></label>}
 <label>Tu mazo<select aria-label="Mazo del jugador 1" value={first} onChange={e=>setFirst(e.target.value)}><option value="">Elegí un mazo</option>{own.map(d=><option value={d.id} key={d.id}>{d.name} ({size(d)} cartas{size(d)===12?' · clásico':''})</option>)}</select></label>
 {settings.mode==='cpu'&&<label>Dificultad<select aria-label="Dificultad" value={settings.difficulty} onChange={e=>setSettings({...settings,difficulty:e.target.value as Difficulty})}><option value="facil">Fácil</option><option value="normal">Normal</option><option value="dificil">Difícil</option></select></label>}
 {persistent&&<label>{settings.mode==='cpu'?'Perfil del rival PC':'Jugador 2'}<select aria-label="Jugador 2" value={rival} onChange={e=>setRival(e.target.value)}><option value="">Elegí otro perfil</option><PlayerOptions players={players} disabledId={human}/></select></label>}
 {!cpu&&<label>Mazo rival<select aria-label="Mazo del jugador 2" value={second} onChange={e=>setSecond(e.target.value)}><option value="">Elegí un mazo</option>{other.map(d=><option value={d.id} key={d.id}>{d.name} ({size(d)} cartas{size(d)===12?' · clásico':''})</option>)}</select></label>}
 <p>{settings.mode==='cpu'?'La PC toma sus decisiones automáticamente. Las tres dificultades usan las mismas reglas, energía y estadísticas.':'Modo presencial: las manos se ocultan al cambiar de jugador.'}</p>
 <p>{cpu?'La PC recibe 20 cartas al azar en cada partida. Elegí un mazo de 20 cartas para jugar.':'Formato recomendado: 20 cartas. Los mazos clásicos de 12 siguen disponibles; ambos rivales deben usar el mismo tamaño.'}</p>
 {!cpu&&first && second && (!full(first)||!full(second)) && <p>Para iniciar la mesa, completá los mazos de 20 cartas o usá dos clásicos de 12.</p>}
 {!cpu&&first && second && full(first)&&full(second)&&count(first)!==count(second)&&<p>Ambos jugadores deben usar mazos del mismo tamaño.</p>}
 {cpu&&first&&count(first)!==DECK_SIZE&&<p>Tu mazo necesita 20 cartas para enfrentar a la PC.</p>}
 {prepareError&&<Notice onClose={()=>setPrepareError('')}>{prepareError}</Notice>}
 {checking&&<p role="status">Consultando partidas activas…</p>}
 {lookupError&&<Notice onClose={()=>setLookupError('')}>{lookupError} <button className="button secondary" onClick={()=>{setLookupError('');setRefresh(n=>n+1);}}>Volver a consultar</button></Notice>}
 {!!active.length&&<div className="active-game-choice"><strong>Estos perfiles ya tienen una partida en curso.</strong><p>Podés continuarla o empezar una nueva conservando el historial anterior.</p>{active.map(game=><a key={game.id} className="button secondary" href={`#/arena?partida=${game.id}`}>Continuar partida #{game.id} · Turno {game.turn}</a>)}</div>}
 <button className="button primary" disabled={preparing||checking||(cpu?count(first)!==DECK_SIZE:!full(first)||!full(second)||count(first)!==count(second))||(persistent&&(!human||!rival||human===rival))} onClick={()=>void begin()}>{preparing?'Preparando partida…':active.length?'Empezar de cero':settings.mode==='cpu'?'Jugar contra la PC':persistent?'Iniciar partida':'Comenzar desde cero'}</button>
 <a className="text-link" href="#/mazos">Armar o editar mis mazos</a><a className="text-link" href="#/arena?partidas=activas">Recuperar una partida</a>
 </div></section>;
}
