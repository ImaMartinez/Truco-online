import {useEffect,useId,useRef,type CSSProperties,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

export function ResultDialog({children,celebrate,onClose}:{children:ReactNode;celebrate:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);const id=useId();
 useEffect(()=>{
  const trigger=document.activeElement;const element=dialog.current!;element.showModal();
  return()=>{element.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};
 },[]);
 return createPortal(<dialog ref={dialog} className="result-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose();}}>
  {celebrate&&<div className="victory-fireworks" aria-hidden="true">{Array.from({length:5},(_,burst)=><div className="firework-burst" key={burst} style={{'--burst':burst} as CSSProperties}>{Array.from({length:18},(_,spark)=><i key={spark} style={{'--angle':`${spark*20}deg`,'--spark':spark} as CSSProperties}/>)}</div>)}</div>}
  <div className="result-dialog-content" id={id}>{children}<button type="button" className="button secondary" onClick={onClose}>Ver tablero</button></div>
 </dialog>,document.body);
}
