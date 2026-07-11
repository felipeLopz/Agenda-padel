import { useEffect } from 'react';
import { useAgenda } from '../state/AgendaContext';

/** Aviso flotante "Deshacer" tras una acción importante (borrar, mover, etc.). */
export default function UndoToast() {
  const { undoInfo, runUndo, dismissUndo } = useAgenda();

  // Se auto-oculta a los 7 segundos.
  useEffect(() => {
    if (!undoInfo) return;
    const t = window.setTimeout(() => dismissUndo(), 7000);
    return () => window.clearTimeout(t);
  }, [undoInfo, dismissUndo]);

  if (!undoInfo) return null;

  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast__label">{undoInfo.label}</span>
      <button className="undo-toast__btn" onClick={runUndo}>
        ↩ Deshacer
      </button>
      <button className="undo-toast__close" onClick={dismissUndo} aria-label="Cerrar">
        ✕
      </button>
      {/* Barra que se va vaciando (7s). El `key` la reinicia con cada aviso nuevo. */}
      <span className="undo-toast__timer" key={undoInfo.at} />
    </div>
  );
}
