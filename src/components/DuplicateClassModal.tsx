import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { classNames } from '../lib/students';
import { classDuration } from '../lib/classMeta';
import { findOverlapStart, hhmmToMinutes, minutesToHHMM, minutesToLabel, nextFreeStart } from '../lib/time';

interface DuplicateClassModalProps {
  from: { day: string; start: number };
  onClose: () => void;
}

function dayToISO(day: string): string {
  const d = parseDayKey(day);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoToDayKey(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${m - 1}-${d}`;
}

/** Duplica una clase a otra franja (copia alumnos, precio, descuentos, etc.). */
export default function DuplicateClassModal({ from, onClose }: DuplicateClassModalProps) {
  const { data, duplicateClass } = useAgenda();
  const dialog = useDialog();
  const entry = data.days[from.day]?.[String(from.start)];
  const [iso, setIso] = useState(() => dayToISO(from.day));
  const [start, setStart] = useState(from.start);

  if (!entry) {
    onClose();
    return null;
  }

  const fromDate = parseDayKey(from.day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  function handleDuplicate() {
    if (!entry) return;
    const to = { day: isoToDayKey(iso), start };
    const ok = duplicateClass(from, to);
    if (!ok) {
      // Se solapa con otra clase del día destino: proponer el próximo horario libre.
      const suggestion = nextFreeStart(data.days[to.day], start, classDuration(entry));
      const conflict = findOverlapStart(data.days[to.day], start, classDuration(entry));
      const conflictEntry = conflict != null ? data.days[to.day]?.[String(conflict)] : undefined;
      const conflictLabel =
        conflict != null && conflictEntry
          ? `${minutesToLabel(conflict)}–${minutesToLabel(conflict + classDuration(conflictEntry))}`
          : 'otra clase';
      void dialog.alert(
        `No se puede duplicar ahí: se solapa con ${conflictLabel}.` +
          (suggestion != null ? ` Probá desde las ${minutesToLabel(suggestion)}.` : '')
      );
      return;
    }
    onClose();
  }

  return (
    <Modal title="Duplicar clase" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Duplicar «{label}» de {WEEKDAY_NAMES_LONG[fromDate.getDay()]} {fromDate.getDate()}/{fromDate.getMonth() + 1}{' '}
          · {minutesToLabel(from.start)}. Copia alumnos, precio, descuentos, duración y contenido. La copia arranca sin
          cobrar.
        </p>
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Día</label>
            <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
          </div>
          <div>
            <label>Hora</label>
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
          <button className="btn btn--primary" onClick={handleDuplicate}>
            Duplicar
          </button>
        </div>
      </div>
    </Modal>
  );
}
