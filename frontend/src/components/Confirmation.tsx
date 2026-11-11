import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Question { title: string; message: string; action: string }
function Confirmation({ question, answer }: { question: Question; answer: (yes: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current!;
    element.showModal(); cancel.current?.focus();
    return () => element.close();
  }, []);
  return createPortal(<dialog ref={dialog} className="confirmation-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`}
    onCancel={event => { event.preventDefault(); answer(false); }}>
    <span className="eyebrow">TRUCO ARENA</span>
    <h2 id={`${id}-title`}>{question.title}</h2>
    <p id={`${id}-message`}>{question.message}</p>
    <div className="confirmation-actions">
      <button ref={cancel} type="button" className="button secondary" onClick={() => answer(false)}>Cancelar</button>
      <button type="button" className="button primary" onClick={() => answer(true)}>{question.action}</button>
    </div>
  </dialog>, document.body);
}

export function useConfirmation() {
  const [question, setQuestion] = useState<Question | null>(null);
  const resolve = useRef<((yes: boolean) => void) | null>(null);
  useEffect(() => () => { resolve.current?.(false); }, []);
  function answer(yes: boolean) { resolve.current?.(yes); resolve.current = null; setQuestion(null); }
  function confirm(question: Question): Promise<boolean> {
    return new Promise(done => { resolve.current = done; setQuestion(question); });
  }
  return { confirm, dialog: question ? <Confirmation question={question} answer={answer} /> : null };
}
