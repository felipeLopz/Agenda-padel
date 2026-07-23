import Modal from './Modal';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES, MONTH_NAMES } from '../lib/constants';
import { classNames, displayName } from '../lib/students';
import { formatCurrency } from '../lib/format';
import { minutesToLabel } from '../lib/time';
import { useAgenda } from '../state/AgendaContext';
import type { DueReminder } from '../hooks/useReminders';
import type { MonthlyCollectItem } from '../hooks/useMonthlyCollection';

/** "YYYY-MM-DDTHH:mm" → "DD/MM HH:mm" para mostrar la hora del aviso. */
function whenLabel(remindAt: string): string {
  const d = new Date(remindAt);
  if (Number.isNaN(d.getTime())) return remindAt;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface MonthlyCollection {
  period: string;
  items: MonthlyCollectItem[];
  pending: MonthlyCollectItem[];
  pendingCount: number;
  dismissed: boolean;
}

interface RemindersPanelProps {
  due: DueReminder[];
  upcoming: DueReminder[];
  monthly: MonthlyCollection;
  onOpenDay: (day: string) => void;
  onCollectMonth: (studentId: string, period: string) => void;
  onOpenStudent: (studentId: string) => void;
  onDismissMonthly: () => void;
  onClose: () => void;
}

/** "YYYY-MM" → "Julio 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
}

/** Panel de recordatorios: "Cobros del mes", "Pendientes" (ya llegó la hora) y "Próximos". */
export default function RemindersPanel({
  due,
  upcoming,
  monthly,
  onOpenDay,
  onCollectMonth,
  onOpenStudent,
  onDismissMonthly,
  onClose,
}: RemindersPanelProps) {
  const { data, setReminder } = useAgenda();

  function markDone(r: DueReminder) {
    setReminder(r.day, r.start, { ...r.reminder, done: true });
  }

  function row(r: DueReminder, pending: boolean) {
    const date = parseDayKey(r.day);
    const names = classNames(r.entry, data.students).join(', ') || 'Turno';
    return (
      <div key={`${r.day}-${r.start}`} className={`reminder-row${pending ? ' reminder-row--due' : ''}`}>
        <div className="reminder-row__main">
          <span className="reminder-row__text">🔔 {r.reminder.text}</span>
          <button
            className="reminder-row__turno"
            onClick={() => {
              onOpenDay(r.day);
              onClose();
            }}
          >
            {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1} · {minutesToLabel(r.start)} · {names}
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

  const monthlyPending = monthly.dismissed ? [] : monthly.pending;

  return (
    <Modal title="Recordatorios" onClose={onClose}>
      <div className="reminders">
        {/* Cobros del mes (v16): a quién cobrarle el mes. Un alumno sale de la lista cuando
            su mes queda saldado, así "cobrar" acá es el cobro de verdad. */}
        {monthlyPending.length > 0 && (
          <div className="reminders__section">
            <span className="profile__section-title">
              Cobros de {periodLabel(monthly.period)} ({monthlyPending.length})
            </span>
            {monthlyPending.map((it) => {
              const student = data.students[it.studentId];
              if (!student) return null;
              return (
                <div key={it.studentId} className="reminder-row reminder-row--due">
                  <div className="reminder-row__main">
                    <span className="reminder-row__text">
                      {it.monthly ? '📅' : '💵'} {displayName(student)}
                    </span>
                    <span className="reminder-row__when">
                      {it.monthly
                        ? `Cuota: ${formatCurrency(it.fee)} · ${it.classes} clase${it.classes === 1 ? '' : 's'}`
                        : `Debe ${formatCurrency(it.pending)} en ${it.classes} clase${it.classes === 1 ? '' : 's'} (paga por clase)`}
                    </span>
                  </div>
                  {it.monthly ? (
                    <button className="btn btn--small btn--primary" onClick={() => onCollectMonth(it.studentId, monthly.period)}>
                      Cobrar el mes
                    </button>
                  ) : (
                    <button className="btn btn--small btn--ghost" onClick={() => onOpenStudent(it.studentId)}>
                      Ver alumno
                    </button>
                  )}
                </div>
              );
            })}
            <button className="btn btn--ghost btn--small reminders__dismiss" onClick={onDismissMonthly}>
              Posponer este mes
            </button>
          </div>
        )}

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
