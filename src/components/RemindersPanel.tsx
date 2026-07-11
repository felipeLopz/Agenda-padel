import Modal from './Modal';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES } from '../lib/constants';
import { classNames } from '../lib/students';
import { useAgenda } from '../state/AgendaContext';
import type { DueReminder } from '../hooks/useReminders';

/** "YYYY-MM-DDTHH:mm" → "DD/MM HH:mm" para mostrar la hora del aviso. */
function whenLabel(remindAt: string): string {
  const d = new Date(remindAt);
  if (Number.isNaN(d.getTime())) return remindAt;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface RemindersPanelProps {
  due: DueReminder[];
  upcoming: DueReminder[];
  onOpenDay: (day: string) => void;
  onClose: () => void;
}

/** Panel de recordatorios: "Pendientes" (ya llegó la hora) y "Próximos". */
export default function RemindersPanel({ due, upcoming, onOpenDay, onClose }: RemindersPanelProps) {
  const { data, setReminder } = useAgenda();

  function markDone(r: DueReminder) {
    setReminder(r.day, r.hour, { ...r.reminder, done: true });
  }

  function row(r: DueReminder, pending: boolean) {
    const date = parseDayKey(r.day);
    const names = classNames(r.entry, data.students).join(', ') || 'Turno';
    return (
      <div key={`${r.day}-${r.hour}`} className={`reminder-row${pending ? ' reminder-row--due' : ''}`}>
        <div className="reminder-row__main">
          <span className="reminder-row__text">🔔 {r.reminder.text}</span>
          <button
            className="reminder-row__turno"
            onClick={() => {
              onOpenDay(r.day);
              onClose();
            }}
          >
            {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1} · {r.hour}:00 · {names}
          </button>
          <span className="reminder-row__when">Avisar: {whenLabel(r.reminder.remindAt)}</span>
        </div>
        {pending && (
          <button className="btn btn--small btn--primary" onClick={() => markDone(r)}>
            Hecho
          </button>
        )}
      </div>
    );
  }

  return (
    <Modal title="Recordatorios" onClose={onClose}>
      <div className="reminders">
        <div className="reminders__section">
          <span className="profile__section-title">Pendientes ({due.length})</span>
          {due.length === 0 && <p className="search-empty">No hay recordatorios pendientes. 🎾</p>}
          {due.map((r) => row(r, true))}
        </div>
        {upcoming.length > 0 && (
          <div className="reminders__section">
            <span className="profile__section-title">Próximos</span>
            {upcoming.map((r) => row(r, false))}
          </div>
        )}
      </div>
    </Modal>
  );
}
