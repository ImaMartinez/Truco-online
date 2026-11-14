import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export function AboutDialog({ persistent, onClose }: { persistent: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const trigger = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <span className="eyebrow">TRUCO ARENA</span>
      <h2 id={`${id}-title`}>Sobre Truco Arena</h2>
      <div id={`${id}-message`}>
        <p>Armá tu mazo, administrá tu energía y enfrentá al rival con naipes españoles.</p>
        <p>{persistent ? 'Modo local: podés retomar tus partidas guardadas en este equipo.' : 'Modo demostración: las partidas son temporales.'}</p>
      </div>
      <div className="confirmation-actions">
        <button type="button" className="button primary" onClick={onClose}>Cerrar</button>
      </div>
    </dialog>, document.body,
  );
}
