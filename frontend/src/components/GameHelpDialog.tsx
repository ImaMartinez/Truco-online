import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function GameHelpDialog({computer,persistent,postgres=false,online=false,onClose,children}:{computer:boolean;persistent:boolean;postgres?:boolean;online?:boolean;onClose:()=>void;children?:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);const close=useRef<HTMLButtonElement>(null);const id=useId();
 useEffect(()=>{const trigger=document.activeElement;const element=dialog.current!;element.showModal();close.current?.focus();return()=>{element.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};},[]);
 return createPortal(<dialog ref={dialog} className="confirmation-dialog game-help-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}>
  <span className="eyebrow">TRUCO ARENA</span><h2 id={id}>Cómo jugar</h2>
  <ol>
   <li>Comenzás con 20 puntos de vida. Tu objetivo es reducir la vida del rival a cero.</li>
   <li>Arrastrá una carta de tu mano a un espacio libre o seleccionala y tocá «Invocar carta». Necesitás energía suficiente; el campo admite hasta tres cartas.</li>
   <li>Una carta recién invocada debe esperar hasta tu próximo turno para atacar. Cada carta puede atacar una vez por turno.</li>
   <li>Tocá una carta lista de tu campo y elegí una carta rival para combatir. Ambas reciben daño simultáneamente; las que se quedan sin vida van al descarte.</li>
   <li>Si el campo rival está vacío, tocar tu atacante hace que ataque directamente los puntos de vida del rival.</li>
   <li>Finalizá tu turno cuando termines. {computer?'La PC pensará y hará su jugada automáticamente.':online?'Esperá la jugada de tu rival. Cada jugador ve únicamente su propia mano.':'Pasá el dispositivo al otro jugador y confirmá su turno.'}</li>
   <li>El robo y la energía se actualizan automáticamente al abrir los turnos según las reglas. El contador «por robar» indica cuántas cartas quedan en el mazo. Agotarlo no causa daño.</li>
   <li>La partida termina al llegar a cero de vida o al cerrar el turno global 30. En ese límite gana quien conserve más vida; con la misma vida, hay empate.</li>
   {online&&<li>Cada turno online dura 15 segundos desde su apertura, aunque invoques o ataques. Al vencer se cierra automáticamente. Tres turnos propios consecutivos vencidos sin jugadas causan derrota por inactividad; una jugada válida o finalizar voluntariamente reinicia el conteo.</li>}
   {online&&<li>«Abandonar partida» pide confirmación y concede la victoria al rival. Recargar, desconectarse o cerrar la pestaña no equivale a abandonar: el tiempo sigue en el servidor.</li>}
  </ol>
  <p className="small-note">{persistent?`${postgres?'PostgreSQL':'MariaDB'} valida y conserva las acciones y el resultado.`:'Esta demo usa una simulación en memoria.'} B1–B4 siguen pendientes de aprobación.</p>
  {children}
  <div className="confirmation-actions"><button ref={close} type="button" className="button primary" onClick={onClose}>Volver al juego</button></div>
 </dialog>,document.body);
}
