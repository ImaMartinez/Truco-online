import { useEffect, useMemo, useRef, useState, type PointerEvent, type CSSProperties } from "react";
import type {
  Card as CardData,
  CardInstance,
  DuelAction,
  DuelState,
  ActionRequest,
} from "../../../shared/contracts";
import { api, uncertainFailure } from "../api";
import { Card, CardBack } from "../components/Card";
import { Notice } from "../components/GameHeader";
import { Icon } from "../components/Icon";
import { PlayerPanel } from "../components/PlayerPanel";
import { readPending, writePending } from "../pendingRequests";
import { computerAction, opponentFor, rememberOpponent } from '../computer';
import { animateCombat } from '../combatAnimation';
import { ResultDialog } from '../components/ResultDialog';
import { GameHelpDialog } from '../components/GameHelpDialog';
import { ArenaIndicators } from '../components/ArenaIndicators';
import { animateDraw } from '../drawAnimation';

export function Battlefield({
  cards,
  duel,
  onUpdate,
  onReset,
}: {
  cards: CardData[];
  duel: DuelState;
  onUpdate: (duel: DuelState) => void;
  onReset: (scenario: "mesa-abierta" | "inicio") => void;
}) {
  const [selected, setSelected] = useState<{
    kind: "hand" | "attacker";
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultDismissed,setResultDismissed]=useState(false);
  const [showHelp,setShowHelp]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const logRef=useRef<HTMLOListElement>(null);
  const followLog=useRef(true);
  const [opponent] = useState(() => opponentFor(duel));
  useEffect(()=>{rememberOpponent(duel,opponent);},[duel.id,opponent]);
  const computer = opponent.mode === 'cpu';
  const [transition, setTransition] = useState(!computer && duel.status !== "finished");
  useEffect(()=>{if(followLog.current&&logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[duel.version,showHistory,transition]);
  const [computerPaused, setComputerPaused] = useState(false);
  const computerTurn = computer && duel.activePlayerId !== opponent.humanId && duel.status === 'active';
  const blocked = busy || computerTurn;
  const [positions,setPositions] = useState<Record<string,number>>(() => {
    try { return JSON.parse(localStorage.getItem(`truco-arena:slots:${duel.id}`) ?? '{}'); } catch { return {}; }
  });
  const [drag,setDrag] = useState<{id:string;x:number;y:number}|null>(null);
  const [hoveredHand,setHoveredHand]=useState<string|null>(null);
  const pointer = useRef<{id:string;x:number;y:number;moved:boolean}|null>(null);
  const suppressClick = useRef(false);
  const runningComputer = useRef(false);
  const [computerStep,setComputerStep] = useState(0);
  const combatAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>combatAbort.current?.abort(),[]);
  const persistent = duel.mode === "persistent";
  const pendingKey = `truco-arena:sql:turn:${duel.id}`;
  const [pendingAction, setPendingAction] = useState<ActionRequest | null>(() => persistent ? readPending<ActionRequest>(pendingKey) : null);
  const pendingActionRef = useRef<ActionRequest | null>(pendingAction);
  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const actor = duel.players.find(
    (player) => player.id === (computer ? opponent.humanId : duel.activePlayerId),
  )!;
  const rival = duel.players.find(
    (player) => player.id !== actor.id,
  )!;
  const selectedInstance =
    selected?.kind === "hand"
      ? actor.hand.find((copy) => copy.id === selected.id)
      : actor.field.find((copy) => copy.id === selected?.id);
  const selectedCard = selectedInstance
    ? cardMap.get(selectedInstance.cardId)
    : null;
  const previewInstance=drag?actor.hand.find(copy=>copy.id===drag.id):selected?.kind==='hand'?selectedInstance:null;
  const previewCost=!blocked&&!pendingAction&&duel.status==='active'&&previewInstance?(cardMap.get(previewInstance.cardId)?.cost??0):0;
  const fanStyle=(index:number,count:number):CSSProperties=>{
    const offset=index-(count-1)/2;
    return {'--fan-angle':`${offset*Math.min(7,28/Math.max(1,count-1))}deg`,'--fan-drop':`${Math.abs(offset)*Math.min(3,12/Math.max(1,count-1))}px`,'--fan-index':index} as CSSProperties;
  };

  async function sendAction(input: ActionRequest) {
    setBusy(true);
    setError("");
    if (!computer && input.action.type === "endTurn") setTransition(true);
    try {
      const next = await api.action(duel.id, input);
      pendingActionRef.current = null;
      setPendingAction(null);
      if (persistent) writePending(pendingKey, null);
      if(input.action.type==='attack'){
        combatAbort.current?.abort();const controller=new AbortController();combatAbort.current=controller;
        try { await animateCombat(duel,next,input,controller.signal); } catch { /* A visual failure never changes a confirmed game result. */ }
      }
      if(input.action.type==='endTurn'){
        combatAbort.current?.abort();const controller=new AbortController();combatAbort.current=controller;
        try{await animateDraw(duel,next,input,controller.signal);}catch{/* A visual failure never changes a confirmed draw. */}
      }
      onUpdate(next);
      setComputerPaused(false);
      setSelected(null);
      // A replay can return a newer snapshot. Never reveal another actor's hand.
      setTransition(!computer && next.status !== "finished" && (
        input.action.type === "endTurn" ||
        next.activePlayerId !== (input.actorId ?? duel.activePlayerId) ||
        next.turn !== duel.turn ||
        Boolean(next.operation?.replayed && next.version !== next.operation.versionResult)
      ));
    } catch (e) {
      if (computerTurn) setComputerPaused(true);
      setSelected(null);
      const uncertain = persistent && uncertainFailure(e);
      if (!uncertain) { pendingActionRef.current = null; setPendingAction(null); if (persistent) writePending(pendingKey, null); }
      setError(
        e instanceof Error ? e.message : "No se pudo completar la acción.",
      );
      try {
        const refreshed = await api.duel(duel.id);
        onUpdate(refreshed);
        setTransition(!computer && (uncertain || (
          refreshed.activePlayerId !== duel.activePlayerId ||
            refreshed.turn !== duel.turn
        )));
      } catch {
        setTransition(!computer && (uncertain || input.action.type === "endTurn"));
      }
    } finally {
      setBusy(false);
    }
  }
  async function action(command: DuelAction) {
    if (blocked || duel.status === 'finished') return;
    if (pendingActionRef.current) { setError("Hay una acción sin resultado confirmado. Reintentá esa misma acción antes de continuar."); return; }
    const input: ActionRequest = {
      expectedVersion: duel.version,
      action: command,
      ...(persistent ? { actorId: duel.activePlayerId, requestId: crypto.randomUUID() } : {}),
    };
    if (persistent) { pendingActionRef.current = input; setPendingAction(input); writePending(pendingKey, input); }
    await sendAction(input);
  }

  useEffect(() => {
    if (!computerTurn || busy || pendingAction || computerPaused || showHelp || runningComputer.current) return;
    // Cosmetic thinking delay. The selected action still goes through the authoritative API/SQL.
    const timer = window.setTimeout(async () => {
      if (runningComputer.current) return;
      runningComputer.current = true;
      const input: ActionRequest = { expectedVersion: duel.version, action: computerAction(duel,cards,opponent.difficulty),
        ...(persistent ? {actorId:duel.activePlayerId,requestId:crypto.randomUUID()} : {}) };
      if(persistent){pendingActionRef.current=input;setPendingAction(input);writePending(pendingKey,input);}
      try { await sendAction(input); } finally { runningComputer.current=false;setComputerStep(step=>step+1); }
    }, 650 + Math.random()*650);
    return () => window.clearTimeout(timer);
  }, [duel.version,computerTurn,busy,pendingAction,computerPaused,computerStep,showHelp]);

  const slots: (CardInstance|null)[] = [null,null,null];
  for(const copy of actor.field){const desired=positions[copy.id];const slot=Number.isInteger(desired)&&desired>=0&&desired<3&&!slots[desired]?desired:slots.indexOf(null);if(slot>=0)slots[slot]=copy;}
  function playInto(id:string,slot:number){
    const copy=actor.hand.find(c=>c.id===id);const card=copy&&cardMap.get(copy.cardId);
    if(blocked||pendingAction||duel.status!=='active'||!card||slots[slot])return;
    if(card.cost>actor.energy){setError(`Necesitás ${card.cost} de energía y tenés ${actor.energy}.`);return;}
    const next={...positions,[id]:slot};setPositions(next);localStorage.setItem(`truco-arena:slots:${duel.id}`,JSON.stringify(next));
    void action({type:'play',instanceId:id});
  }
  function pointerDown(event:PointerEvent<HTMLDivElement>,id:string){
    if(blocked||pendingAction||duel.status!=='active'||event.button!==0)return;
    pointer.current={id,x:event.clientX,y:event.clientY,moved:false};
    suppressClick.current=false;
  }
  function pointerMove(event:PointerEvent<HTMLDivElement>){
    const current=pointer.current;if(!current)return;
    if(Math.hypot(event.clientX-current.x,event.clientY-current.y)>8)current.moved=true;
    if(current.moved){event.preventDefault();if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId);suppressClick.current=true;setDrag({id:current.id,x:event.clientX,y:event.clientY});}
  }
  function pointerUp(event:PointerEvent<HTMLDivElement>){
    const current=pointer.current;pointer.current=null;setDrag(null);
    if(!current?.moved)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-field-slot]');
    if(target)playInto(current.id,Number(target.dataset.fieldSlot));
  }
  function hoverHand(event:PointerEvent<HTMLDivElement>){
    if(event.pointerType!=='mouse'||pointer.current?.moved||!matchMedia('(min-width:761px)').matches){setHoveredHand(null);return;}
    const candidates=[...event.currentTarget.querySelectorAll<HTMLElement>('[data-hand-instance]')].map(element=>{
      const box=element.getBoundingClientRect();return {id:element.dataset.handInstance!,distance:Math.abs(event.clientX-box.left-box.width/2),width:box.width};
    }).sort((a,b)=>a.distance-b.distance);
    const closest=candidates[0];setHoveredHand(closest&&closest.distance<=closest.width/2+5?closest.id:null);
  }

  async function reveal() {
    setBusy(true);
    setError("");
    try {
      const next = await api.duel(duel.id);
      onUpdate(next);
      const changed = next.status !== "finished" && (next.activePlayerId !== duel.activePlayerId || next.turn !== duel.turn);
      setTransition(changed);
      if (changed) setError("El turno cambió mientras se consultaba la mesa. Confirmá el nuevo jugador antes de mostrar su mano.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo confirmar el estado de la mesa.",
      );
    } finally {
      setBusy(false);
    }
  }

  const fieldCard = (instance: CardInstance, enemy: boolean) => {
    const card = cardMap.get(instance.cardId);
    if (!card) return null;
    const ready=duel.status==='active'&&duel.activePlayerId===(enemy?rival.id:actor.id)&&instance.enteredTurn<duel.turn&&instance.lastAttackTurn!==duel.turn;
    const status=duel.status==='finished'?'Partida terminada':instance.enteredTurn>=duel.turn?'Preparándose':instance.lastAttackTurn===duel.turn?'Ya atacó':ready?'Lista para atacar':'No es su turno';
    return (
      <div
        className={`field-card ${ready?'is-ready':'is-exhausted'} ${enemy && selected?.kind === "attacker" ? "attack-target" : ""}`}
        data-attack-ready={ready}
        key={instance.id}
      >
        <Card
          compact
          card={card}
          instance={instance}
          status={status}
          selected={selected?.id === instance.id}
          disabled={blocked || !!pendingAction || duel.status === "finished" || (enemy ? selected?.kind !== "attacker" : instance.enteredTurn >= duel.turn || instance.lastAttackTurn === duel.turn)}
          onClick={() => {
            if (enemy) {
              if (selected?.kind === "attacker")
                void action({
                  type: "attack",
                  attackerId: selected.id,
                  targetId: instance.id,
                });
            } else {
              if (rival.field.length === 0) {
                void action({ type: 'attack', attackerId: instance.id, targetId: 'hero' });
                return;
              }
              setSelected({ kind: "attacker", id: instance.id });
              setError("");
            }
          }}
        />
      </div>
    );
  };

  const retryPending = pendingAction && !busy && (
    <div className="persistent-panel" role="status">
      <p>El resultado de {pendingAction.action.type === "endTurn" ? "este cierre" : pendingAction.action.type === "play" ? "esta invocación" : "este ataque"} todavía no fue confirmado. El reintento conserva la misma solicitud para recuperar su resultado sin repetir efectos.</p>
      <button className="button secondary" onClick={() => void sendAction(pendingAction)}>
        {pendingAction.action.type === "endTurn" ? "Reintentar cierre pendiente" : "Reintentar jugada pendiente"}
      </button>
    </div>
  );

  // Private hands and battlefield are unmounted during handover, not just covered.
  if (transition)
    return (
      <section className="turn-curtain" aria-label="Cambio de jugador">
        <div className="curtain-symbol">
          <Icon name="swords" size={45} />
        </div>
        <span className="eyebrow">MANO PRIVADA</span>
        <h1>
          La mesa es
          <br />
          de <em>{actor.name}.</em>
        </h1>
        <p>
          Las manos están ocultas. Cuando el jugador tenga el dispositivo, puede
          continuar.
        </p>
        {error && <Notice onClose={() => setError("")}>{error}</Notice>}
        {retryPending}
        <button
          className="button primary large"
          disabled={busy || !!pendingAction}
          onClick={() => void reveal()}
        >
          {busy ? "Preparando turno…" : "Estoy listo para jugar"}
          <Icon name="arrow" />
        </button>
        <span className="curtain-note">
          {persistent ? `Partida ${duel.id} · Estado guardado en MariaDB · Sin autenticación` : "Demostración presencial · Sin autenticación"}
        </span>
      </section>
    );

  return (
    <>
      {error && <Notice onClose={() => setError("")}>{error}</Notice>}
      {retryPending}
      <div className="arena-layout">
        <section className="battle-table arena-table">
          <div className="table-topline">
      <div className="arena-toolbar" role="group" aria-label="Controles de la partida">
        <button className="button secondary small inline-history-toggle" aria-expanded={showHistory} onClick={()=>setShowHistory(value=>!value)}>{showHistory?'Cerrar bitácora':'Bitácora'}</button>
        <button className="button secondary small" aria-haspopup="dialog" onClick={()=>setShowHelp(true)}>Cómo jugar</button>
        <span className="pill">
          {duel.scenario === "mesa-abierta"
            ? "Mesa preparada"
            : "Partida desde cero"}
        </span>
        {duel.status==='finished'&&<button className="button secondary small" onClick={()=>setResultDismissed(false)}>Ver resultado</button>}
        <button
          className="button secondary small"
          disabled={busy || !!pendingAction}
          onClick={() => onReset(duel.scenario)}
        >
          <Icon name="refresh" size={16} />
          {persistent ? "Preparar otra partida" : "Reiniciar demo"}
        </button>
      </div>

            <span className={`turn-announcement ${computerTurn?'is-opponent-turn':''}`} role="status">
              <span className="live-dot" /> {duel.status==='finished'?'Partida terminada':computerTurn?'Turno de la PC':computer?'Tu turno':`Turno de ${actor.name}`}
            </span>
            <span className="global-turn">
              Turno <strong>{duel.turn}</strong> / 30
            </span>
          </div>

          <div className={`arena-workspace ${showHistory?'history-open':''}`}>
            <aside className="arena-left" aria-label="Participantes e historial">
              <section className="participant-card rival-summary">            <PlayerPanel summaryOnly
              player={computer ? {...rival,name:`PC · ${rival.name}`} : rival}
              active={computerTurn}
              rival
              disabled={blocked || !!pendingAction || duel.status === "finished"}
            /></section>
                      <aside className="arena-sidebar in-table-history" aria-label="Movimientos de la partida">
          {persistent&&<p className="small-note">Partida {duel.id} guardada en MariaDB. Podés recuperarla al recargar su dirección.</p>}
          <div className="arena-info">
            <span className="eyebrow">LA MESA TE CUENTA</span>
            <h2>Bitácora del duelo</h2>
            <ol ref={logRef} className="battle-log" tabIndex={0} aria-label="Movimientos recientes" aria-live="polite" aria-relevant="additions" onScroll={event=>{const element=event.currentTarget;followLog.current=element.scrollHeight-element.scrollTop-element.clientHeight<24;}}>
              {duel.log.map((line, i) => (
                <li key={`${i}-${line}`} className={/atac|invoc|descart|victor|gana/i.test(line)?"important-event":undefined}>
                  <span className="log-dot" />
                  {line}
                </li>
              ))}
            </ol>
            {persistent && <details className="complete-history"><summary>Historial completo ({duel.history?.length ?? 0} jugadas)</summary><ol>{duel.log.map((line, i) => <li key={i}>{line}</li>)}</ol></details>}
          </div>
          {persistent && duel.players.some(player => player.discard?.length) && <div className="arena-info discarded-cards"><span className="eyebrow">DESCARTE PÚBLICO</span><h2>Cartas eliminadas</h2>{duel.players.filter(player => player.discard?.length).map(player => <div key={player.id}><h3>{player.name}</h3><div className="discard-grid" aria-label={`Descartes de ${player.name}`}>{player.discard?.map(instance => { const card = cardMap.get(instance.cardId); return card ? <Card compact key={instance.id} card={card} instance={instance} /> : null; })}</div></div>)}</div>}
        </aside>
              <section className="participant-card own-summary">            <PlayerPanel summaryOnly player={actor} active={!computerTurn} energyPreview={previewCost}/>
            <div className="hand-heading">
              <span>
                TU MANO <strong>{actor.hand.length}</strong>
              </span>
            </div>
</section>
            </aside>
            <div className="arena-center" aria-label="Mesa de juego">
              <section className={`rival-zone arena-zone ${computerTurn&&!computerPaused?'is-thinking':''}`}>
                <h2 className="zone-title">{computer?'PC · RIVAL':'RIVAL'}</h2>
                
            <div
              className="rival-hand" data-player-hand={rival.id}
              aria-label={`${rival.hand.length} cartas ocultas del rival`}
            >
              {Array.from(
                { length: Math.min(rival.hand.length, 6) },
                (_, i) => (
                  <CardBack small key={i} style={fanStyle(i,Math.min(rival.hand.length,6))}/>
                ),
              )}
              <span>{rival.hand.length} en mano</span>
            </div>
            {computer && <div className="opponent-activity">
              {computerTurn && <div className="computer-thinking" role="status" aria-live="polite" aria-atomic="true">
                {!computerPaused && <span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span>}
                <span>{computerPaused ? 'La PC está en pausa' : 'La computadora está pensando…'}</span>
                {computerPaused && !pendingAction && <button className="button secondary small" onClick={()=>setComputerPaused(false)}>Reintentar turno de la PC</button>}
              </div>}
            </div>}

              </section>
              <section className="combat-area arena-zone" aria-label="Campo de combate">
                <h2 className="zone-title">Campo de combate</h2>
                            <div className="field-row enemy-field" aria-label="Campo rival">              {rival.field.map((instance) => fieldCard(instance, true))}
              {Array.from(
                { length: Math.max(0, 3 - rival.field.length) },
                (_, i) => (
                  <div className="field-slot rival-slot" key={`rival-slot-${i}`} aria-label="Espacio del campo rival"/>
                ),
              )}
            </div>
          <div className="table-divider">
            <span />
            <strong>
              TRUCO <i>ARENA</i>
            </strong>
            <span />
          </div>
            <div className="field-row own-field" aria-label="Tu campo">              {slots.map((instance,i) => instance ? <div className="occupied-slot" key={instance.id} data-slot-index={i}>{fieldCard(instance,false)}</div> : (
                  <div className={`field-slot own-drop-slot ${drag ? 'drop-ready' : ''}`} key={`own-slot-${i}`} data-field-slot={i} role="button" tabIndex={blocked ? -1 : 0} aria-label={`Invocar en espacio ${i+1}`}
                    onClick={()=>{if(selected?.kind==='hand')playInto(selected.id,i);}}
                    onKeyDown={event=>{if((event.key==='Enter'||event.key===' ')&&selected?.kind==='hand'){event.preventDefault();playInto(selected.id,i);}}}>
                    <Icon name="plus" size={24} />
                    <span>Invocá una carta</span>
                  </div>
              ))}
            </div>

              </section>
              <section className="own-zone arena-zone">
                <h2 className="zone-title">{computer?'VOS':actor.name}</h2>
                            <div className="own-hand" data-player-hand={actor.id} aria-label="Tu mano" onPointerMove={hoverHand} onPointerLeave={()=>setHoveredHand(null)} style={{'--hand-count':actor.hand.length} as CSSProperties}>
              {actor.hand.map((instance,index) => {
                const card = cardMap.get(instance.cardId);
                return (
                  card && (
                    <div key={instance.id} data-hand-instance={instance.id} style={fanStyle(index,actor.hand.length)} className={`draggable-hand-card ${drag?.id===instance.id?'dragging':''} ${hoveredHand===instance.id?'is-hovered':''}`} onPointerDown={e=>pointerDown(e,instance.id)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{pointer.current=null;setDrag(null);}}>
                    <Card
                      compact
                      key={instance.id}
                      card={card}
                      instance={instance}
                      selected={selected?.id === instance.id}
                      disabled={blocked || !!pendingAction || duel.status === "finished"}
                      onClick={() => {
                        if(suppressClick.current){suppressClick.current=false;return;}
                        setSelected({ kind: "hand", id: instance.id });
                        setError("");
                      }}
                    />
                    </div>
                  )
                );
              })}
              {!actor.hand.length && (
                <p className="empty-hand">
                  No quedan cartas en tu mano. Tus cartas en campo todavía
                  pueden actuar.
                </p>
              )}
            </div>

              </section>
            </div>
            <aside className="arena-right" aria-label="Recursos y acciones">
              <ArenaIndicators actor={actor} rival={rival} previewCost={previewCost} actions={<>
                        {selected?.kind === "hand" && actor.field.length >= 3 && <p className="action-unavailable" role="status">Tu campo está completo: admite hasta tres cartas.</p>}
          <div className="action-dock">
            {selected?.kind==='attacker'&&<div className="action-instruction"><strong>Elegí una carta rival para atacar</strong></div>}
            {selected?.kind === "hand" && (
              <button
                className="button secondary"
                disabled={blocked || !!pendingAction || duel.status === "finished" || !selectedCard || actor.energy < selectedCard.cost || actor.field.length >= 3}
                onClick={() =>
                  void action({ type: "play", instanceId: selected.id })
                }
              >
                Invocar carta
              </button>
            )}
            <button
              className="button primary"
              disabled={blocked || !!pendingAction || duel.status === "finished"}
              onClick={() => void action({ type: "endTurn" })}
            >
              {computerTurn ? 'Turno de la PC…' : busy ? "Procesando…" : "Finalizar turno"}
              <Icon name="arrow" size={17} />
            </button>
          </div>

</>}/>
            </aside>
          </div>
        </section>
      </div>
      {showHelp&&<GameHelpDialog computer={computer} persistent={persistent} onClose={()=>setShowHelp(false)}>          {!persistent && <button
            className="scenario-switch"
            disabled={busy}
            onClick={() =>
              onReset(duel.scenario === "inicio" ? "mesa-abierta" : "inicio")
            }
          >
            <Icon name="refresh" size={16} />
            {duel.scenario === "inicio"
              ? "Probar mesa preparada"
              : "Empezar con manos iniciales"}
          </button>}
</GameHelpDialog>}
      {drag && <div className="drag-card-ghost" style={{left:drag.x,top:drag.y}} aria-hidden="true"><Card compact card={cardMap.get(actor.hand.find(copy=>copy.id===drag.id)!.cardId)!}/></div>}
      {duel.status === "finished" && !resultDismissed && (
        <ResultDialog celebrate={!!duel.winnerId&&(!computer||duel.winnerId===actor.id)} onClose={()=>setResultDismissed(true)}>
        <div className="result-panel" role="status">
          <span className="eyebrow">{persistent ? "FIN DE LA PARTIDA" : "FIN DE LA DEMOSTRACIÓN"}</span>
          <h2>
            {duel.result?.reason==='REINICIO' ? 'Esta partida se cerró para empezar de cero.' : duel.winnerId
              ? `${duel.players.find((p) => p.id === duel.winnerId)?.name} se lleva la mesa.`
              : "Una mesa pareja. Es empate."}
          </h2>
          <p>
            {duel.turn} turnos globales · Vida final{" "}
            {duel.players.map((p) => `${p.name}: ${p.life}`).join(" / ")}
          </p>
          {duel.result && <p>{duel.result.reason === 'REINICIO' ? 'Historial conservado. No cuenta como victoria ni empate.' : duel.result.reason === "VIDA_CERO" ? "Victoria inmediata por vida cero." : "Resultado al finalizar el turno global 30."}</p>}
          <button className="button primary" onClick={() => onReset("inicio")}>
            {persistent ? "Preparar otra partida" : "Nueva partida de demostración"}
            <Icon name="arrow" size={17} />
          </button>
        </div>
        </ResultDialog>
      )}
    </>
  );
}
