import { useEffect, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';

/**
 * Check verde discreto que aparece un instante cuando algo se sincronizó a la nube,
 * para dar tranquilidad de que quedó guardado. Se apaga solo.
 */
export default function SyncCheck() {
  const { syncedAt } = useAgenda();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!syncedAt) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1600);
    return () => window.clearTimeout(t);
  }, [syncedAt]);

  if (!show) return null;
  return (
    <div className="sync-check" role="status" aria-live="polite">
      <span className="sync-check__icon" aria-hidden>
        ✓
      </span>
      Guardado
    </div>
  );
}
