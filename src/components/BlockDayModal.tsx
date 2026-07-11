import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { HOURS, WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { cleanBlock } from '../lib/classMeta';

interface BlockDayModalProps {
  day: string;
  onClose: () => void;
}

/** Bloquear un día completo o algunas franjas (vacaciones, día libre, turno personal). */
export default function BlockDayModal({ day, onClose }: BlockDayModalProps) {
  const { data, setDayBlock, removeDayBlock } = useAgenda();
  const existing = data.blocks[day];
  const [fullDay, setFullDay] = useState(Boolean(existing?.fullDay));
  const [hours, setHours] = useState<number[]>(existing?.hours ?? []);
  const [reason, setReason] = useState(existing?.reason ?? '');

  const date = parseDayKey(day);
  const title = `Bloquear · ${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;

  function toggleHour(h: number) {
    setHours((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  }

  function handleSave() {
    const block = cleanBlock({ fullDay, hours, reason });
    if (!block) removeDayBlock(day);
    else setDayBlock(day, block);
    onClose();
  }

  function handleClear() {
    removeDayBlock(day);
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="class-form">
        <label className="checkbox-row">
          <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} />
          Bloquear el día completo
        </label>

        {!fullDay && (
          <div className="class-form__row">
            <label>O bloquear franjas puntuales</label>
            <div className="hour-grid">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`hour-chip${hours.includes(h) ? ' hour-chip--on' : ''}`}
                  onClick={() => toggleHour(h)}
                >
                  {h}:00
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="class-form__row">
          <label>Motivo (opcional)</label>
          <input
            type="text"
            value={reason}
            placeholder="Ej: vacaciones, feriado personal, turno médico..."
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="class-form__actions">
          {existing && (
            <button className="btn btn--ghost" onClick={handleClear}>
              Quitar bloqueo
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
