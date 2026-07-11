import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { scheduleHours } from '../lib/schedule';
import { classNames } from '../lib/students';

interface DuplicateClassModalProps {
  from: { day: string; hour: number };
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
  const entry = data.days[from.day]?.[String(from.hour)];
  const [iso, setIso] = useState(() => dayToISO(from.day));
  const [hour, setHour] = useState(from.hour);

  if (!entry) {
    onClose();
    return null;
  }

  const fromDate = parseDayKey(from.day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;
  const hours = scheduleHours(data.settings);

  function handleDuplicate() {
    const ok = duplicateClass(from, { day: isoToDayKey(iso), hour });
    if (!ok) {
      alert('Ya hay una clase en ese día y hora. Elegí otra franja.');
      return;
    }
    onClose();
  }

  return (
    <Modal title="Duplicar clase" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Duplicar «{label}» de {WEEKDAY_NAMES_LONG[fromDate.getDay()]} {fromDate.getDate()}/{fromDate.getMonth() + 1}{' '}
          · {from.hour}:00. Copia alumnos, precio, descuentos, duración y contenido. La copia arranca sin cobrar.
        </p>
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Día</label>
            <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
          </div>
          <div>
            <label>Hora</label>
            <select className="select" value={hour} onChange={(e) => setHour(Number(e.target.value))}>
              {hours.map((h) => (
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
          <button className="btn btn--primary" onClick={handleDuplicate}>
            Duplicar
          </button>
        </div>
      </div>
    </Modal>
  );
}
