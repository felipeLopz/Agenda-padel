import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { HOURS, WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { classNames } from '../lib/students';

interface MoveClassModalProps {
  from: { day: string; hour: number };
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
  const entry = data.days[from.day]?.[String(from.hour)];
  const [iso, setIso] = useState(() => todayISO(from.day));
  const [hour, setHour] = useState(from.hour);

  if (!entry) {
    onClose();
    return null;
  }

  const fromDate = parseDayKey(from.day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  function handleMove() {
    const to = { day: isoToDayKey(iso), hour };
    const ok = moveClass(from, to);
    if (!ok) {
      alert('Ya hay una clase en ese día y hora. Elegí otra franja.');
      return;
    }
    onClose();
  }

  return (
    <Modal title="Mover clase" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Mover «{label}» de {WEEKDAY_NAMES_LONG[fromDate.getDay()]} {fromDate.getDate()}/{fromDate.getMonth() + 1} ·{' '}
          {from.hour}:00. Se conservan alumnos, precio, descuentos y pagos.
        </p>
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Nuevo día</label>
            <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
          </div>
          <div>
            <label>Nueva hora</label>
            <select className="select" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
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
