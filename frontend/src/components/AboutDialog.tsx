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
      <h2 id={`${id}-title`}>{persistent ? 'Sobre este corte SQL' : 'Sobre esta demo'}</h2>
      <div id={`${id}-message`}>
        {persistent ? <>
          <p>La partida usa truco_arena_dev. MariaDB valida y conserva invocaciones, ataques, turnos y resultados.</p>
          <p>Los perfiles se eligen presencialmente, sin autenticación remota.</p>
        </> : <>
          <p>Esta es una simulación local. El catálogo contiene las 40 estadísticas documentadas; mazos y duelos viven en memoria y se pierden al reiniciar el backend.</p>
          <p>La validación definitiva de acciones se implementará en MariaDB.</p>
        </>}
        <p>B1–B4 siguen pendientes de aprobación.</p>
      </div>
      <div className="confirmation-actions">
        <button type="button" className="button primary" onClick={onClose}>Cerrar</button>
      </div>
    </dialog>, document.body,
  );
}
