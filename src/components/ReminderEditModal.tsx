import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { minutesToLabel } from '../lib/time';

/** Formatea un Date a "YYYY-MM-DDTHH:mm" (lo que usa <input type="datetime-local">). */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface ReminderEditModalProps {
  day: string;
  /** Hora de inicio de la clase en minutos (v10). */
  start: number;
  onClose: () => void;
}

/** Agrega / edita / borra el recordatorio de un turno puntual. */
export default function ReminderEditModal({ day, start, onClose }: ReminderEditModalProps) {
  const { data, setReminder } = useAgenda();
  const dialog = useDialog();
  const existing = data.days[day]?.[String(start)]?.reminder;

  // Hora de inicio de la clase, para las opciones rápidas ("X min antes").
  const classStart = parseDayKey(day);
  classStart.setHours(Math.floor(start / 60), start % 60, 0, 0);
  const defaultAt = existing?.remindAt ?? toLocalInput(new Date(classStart.getTime() - 30 * 60000));

  const [text, setText] = useState(existing?.text ?? '');
  const [remindAt, setRemindAt] = useState(defaultAt);

  function quick(minutesBefore: number) {
    setRemindAt(toLocalInput(new Date(classStart.getTime() - minutesBefore * 60000)));
  }

  function handleSave() {
    const t = text.trim();
    if (!t) {
      void dialog.alert('Escribí la nota del recordatorio.');
      return;
    }
    if (!remindAt) {
      void dialog.alert('Elegí la hora del aviso.');
      return;
    }
    // Si cambió la hora del aviso, vuelve a estar pendiente (se resetea "done").
    const done = existing && existing.remindAt === remindAt ? existing.done : false;
    setReminder(day, start, { text: t, remindAt, done });
    onClose();
  }

  function handleDelete() {
    setReminder(day, start, null);
    onClose();
  }

  const date = parseDayKey(day);
  const title = `Recordatorio · ${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1} · ${minutesToLabel(start)}`;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="class-form">
        <div className="class-form__row">
          <label>Nota</label>
          <textarea
            className="student-form__notes"
            rows={2}
            value={text}
            placeholder="Ej: cobrarle a Juan lo que debe, llevar pelotas nuevas..."
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="class-form__row">
          <label>Avisarme</label>
          <div className="reminder-quick">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => quick(15)}>
              15 min antes
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => quick(30)}>
              30 min antes
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => quick(60)}>
              1 hora antes
            </button>
          </div>
          <input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
        </div>

        <div className="class-form__actions">
          {existing && (
            <button
              type="button"
              className="btn btn--small day-slot__delete-btn class-form__delete"
              onClick={handleDelete}
            >
              🗑 Borrar
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
