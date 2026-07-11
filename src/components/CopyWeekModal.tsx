import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { addDays, dayKey, startOfWeek } from '../lib/date';

interface CopyWeekModalProps {
  /** Lunes de la semana de origen (la que se está viendo). */
  fromMonday: Date;
  onClose: () => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Copia todas las clases de la semana actual a otra semana elegida. */
export default function CopyWeekModal({ fromMonday, onClose }: CopyWeekModalProps) {
  const { data, copyWeek } = useAgenda();
  // Por defecto, la semana siguiente.
  const [targetISO, setTargetISO] = useState(() => dateToISO(addDays(fromMonday, 7)));

  const toMonday = startOfWeek(isoToDate(targetISO));

  // Contar clases a copiar y conflictos en el destino.
  let toCopy = 0;
  let conflicts = 0;
  for (let i = 0; i < 7; i++) {
    const src = data.days[dayKey(addDays(fromMonday, i))];
    if (!src) continue;
    for (const hour of Object.keys(src)) {
      toCopy += 1;
      if (data.days[dayKey(addDays(toMonday, i))]?.[hour]) conflicts += 1;
    }
  }

  function handleCopy() {
    const res = copyWeek(fromMonday, toMonday);
    let msg = `Se copiaron ${res.copied} clases.`;
    if (res.skipped > 0) msg += ` Se omitieron ${res.skipped} porque el destino ya tenía clase en esa franja.`;
    alert(msg);
    onClose();
  }

  return (
    <Modal title="Copiar semana" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Copia las <strong>{toCopy}</strong> clases de esta semana a la semana que contenga la fecha elegida
          (lunes {toMonday.getDate()}/{toMonday.getMonth() + 1}). Las copias arrancan sin cobrar; los pagos no se
          copian.
        </p>
        <div className="class-form__row">
          <label>Semana destino (elegí cualquier día de esa semana)</label>
          <input type="date" value={targetISO} onChange={(e) => setTargetISO(e.target.value)} />
        </div>
        {conflicts > 0 && (
          <p className="settings__hint text-pending">
            ⚠ {conflicts} franja(s) del destino ya tienen clase: esas se van a <strong>omitir</strong> (no se
            pisan).
          </p>
        )}
        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleCopy} disabled={toCopy === 0}>
            Copiar {toCopy} clases
          </button>
        </div>
      </div>
    </Modal>
  );
}
