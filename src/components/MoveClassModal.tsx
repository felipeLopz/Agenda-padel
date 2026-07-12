import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { classNames } from '../lib/students';
import { classDuration } from '../lib/classMeta';
import { findOverlapStart, hhmmToMinutes, minutesToHHMM, minutesToLabel, nextFreeStart } from '../lib/time';

interface MoveClassModalProps {
  from: { day: string; start: number };
  onClose: () => void;
}

function todayISO(day: string): string {
  const d = parseDayKey(day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoToDayKey(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${m - 1}-${d}`;
}

/** Reprograma una clase: la mueve a otro día y hora (conserva todo). */
export default function MoveClassModal({ from, onClose }: MoveClassModalProps) {
  const { data, moveClass } = useAgenda();
  const dialog = useDialog();
  const entry = data.days[from.day]?.[String(from.start)];
  const [iso, setIso] = useState(() => todayISO(from.day));
  // Hora de inicio elegida, en minutos.
  const [start, setStart] = useState(from.start);

  if (!entry) {
    onClose();
    return null;
  }

  const fromDate = parseDayKey(from.day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  function handleMove() {
    if (!entry) return;
    const to = { day: isoToDayKey(iso), start };
    const ok = moveClass(from, to);
    if (!ok) {
      // Se solapa con otra clase: proponer el próximo horario libre de ese día.
      const excludeStart = to.day === from.day ? from.start : undefined;
      const suggestion = nextFreeStart(data.days[to.day], start, classDuration(entry), excludeStart);
      const conflict = findOverlapStart(data.days[to.day], start, classDuration(entry), excludeStart);
      const conflictEntry = conflict != null ? data.days[to.day]?.[String(conflict)] : undefined;
      const conflictLabel =
        conflict != null && conflictEntry
          ? `${minutesToLabel(conflict)}–${minutesToLabel(conflict + classDuration(conflictEntry))}`
          : 'otra clase';
      void dialog.alert(
        `No se puede mover ahí: se solapa con ${conflictLabel}.` +
          (suggestion != null ? ` Probá desde las ${minutesToLabel(suggestion)}.` : '')
      );
      return;
    }
    onClose();
  }

  return (
    <Modal title="Mover clase" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Mover «{label}» de {WEEKDAY_NAMES_LONG[fromDate.getDay()]} {fromDate.getDate()}/{fromDate.getMonth() + 1} ·{' '}
          {minutesToLabel(from.start)}. Se conservan alumnos, precio, descuentos y pagos.
        </p>
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Nuevo día</label>
            <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
          </div>
          <div>
            <label>Nueva hora</label>
            <input
              type="time"
              step={900}
              value={minutesToHHMM(start)}
              onChange={(e) => {
                const m = hhmmToMinutes(e.target.value);
                if (m != null) setStart(m);
              }}
            />
          </div>
        </div>
        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleMove}>
            Mover
          </button>
        </div>
      </div>
    </Modal>
  );
}
