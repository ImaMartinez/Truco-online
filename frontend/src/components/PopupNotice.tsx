import {Children,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './Icon';

function MessageDialog({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{const trigger=document.activeElement,dialog=ref.current!;dialog.showModal();close.current?.focus();return()=>{dialog.close();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus();};},[]);
 return createPortal(<dialog ref={ref} className="confirmation-dialog game-message-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={e=>{e.preventDefault();onClose();}}>
  <button type="button" className="icon-button message-close" aria-label="Cerrar aviso" onClick={onClose}><Icon name="close" size={20}/></button>
  <span className="eyebrow">TRUCO ARENA</span><h2 id={`${id}-title`}>{title}</h2>
  <div id={`${id}-message`} className="game-message-content">{children}</div>
  <div className="confirmation-actions"><button ref={close} type="button" className="button primary" onClick={onClose}>Entendido</button></div>
 </dialog>,document.body);
}

/** Dismiss one error episode without clearing pending operations or polling state. */
export function PopupNotice({children,onClose,title='No se pudo completar la acción',identity,reopenLabel='Ver aviso pendiente',reopen=!onClose}:{children:ReactNode;onClose?:()=>void;title?:string;identity?:string;reopenLabel?:string;reopen?:boolean}){
 const text=identity??(Children.toArray(children).filter(child=>typeof child==='string'||typeof child==='number').join('')||title);
 const [dismissed,setDismissed]=useState<string|null>(null);
 function dismiss(){setDismissed(text);onClose?.();}
 if(typeof document==='undefined')return null;
 if(dismissed!==text)return <MessageDialog title={title} onClose={dismiss}>{children}</MessageDialog>;
 if(!reopen)return null;
 return createPortal(<div className="floating-notice"><button type="button" className="button secondary" aria-haspopup="dialog" onClick={()=>setDismissed(null)}><Icon name="help" size={17}/>{reopenLabel}</button></div>,document.body);
}
