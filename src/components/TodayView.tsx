import { useEffect, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { CLASS_TYPE_LABEL } from '../lib/constants';
import { dayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayEntries, classStatus, STATUS_LABEL, classKey, studentDebt } from '../lib/money';
import { participantName, isBirthdayOn } from '../lib/students';
import { classDuration, classState, isChargeable, STATE_LABEL, stateMoneyNote } from '../lib/classMeta';
import { freeHourSlots } from '../lib/schedule';
import { classRangeLabel, minutesToLabel } from '../lib/time';
import AttendanceToggle from './AttendanceToggle';
import PaymentToggle from './PaymentToggle';
import CashCloseModal from './CashCloseModal';
import type { ClassEntry } from '../types';

interface TodayViewProps {
  /** Entrar al turno (abre el formulario de la clase). */
  onOpenClass: (start: number, entry: ClassEntry) => void;
  /** Crear un turno nuevo empezando en `start` (minutos) — desde un hueco libre. */
  onNewClass: (start: number) => void;
}

/** Minutos del día actual (para saber cuál es el próximo turno). */
function currentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Pantalla "Hoy": el uso diario del profe entre clases. Lista los turnos de hoy en orden,
 * destaca el próximo, y de cada uno muestra lo esencial (horario, tipo, alumnos, cobro) con
 * botones grandes para el celular: cobrar de un toque y marcar asistencia. Tocar un turno lo abre.
 */
export default function TodayView({ onOpenClass, onNewClass }: TodayViewProps) {
  const { data, ledger, quickCollectClass, setAttendance } = useAgenda();
  const [cashOpen, setCashOpen] = useState(false);
  // `today` es un ESTADO (no se recalcula solo en cada render): se refresca por intervalo y,
  // sobre todo, al volver a la app (visibilitychange/focus). Así, si la PWA quedó abierta o en
  // segundo plano cuando cambió el día (medianoche), "Hoy" no queda pegado a la fecha de ayer.
  const [nowMin, setNowMin] = useState(() => currentMinutes());
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const refresh = () => {
      setNowMin(currentMinutes());
      setToday(dayKey(new Date())); // si cambió el día, se actualiza; si no, React no re-renderiza
    };
    const id = window.setInterval(refresh, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const classes = dayEntries(data.days[today]); // ya ordenadas por hora de inicio
  // Próximo turno: el primero (no cancelado) que todavía no terminó (en curso o por venir).
  const nextStart = classes.find((c) => isChargeable(c.entry) && c.start + classDuration(c.entry) > nowMin)?.start;
  // Huecos libres del día (horas del horario laboral sin clase ni bloqueo), para meter a alguien.
  const freeSlots = freeHourSlots(data.settings, data, today);
  // Cumpleaños de hoy entre los alumnos que vienen: un saludo simpático dentro de la app.
  const bdayNames = [
    ...new Set(
      classes.flatMap(({ entry }) =>
        entry.participants
          .filter((p) => p.studentId && data.students[p.studentId] && isBirthdayOn(data.students[p.studentId], today))
          .map((p) => participantName(p, data.students))
      )
    ),
  ];

  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (classes.length === 0) {
    return (
      <div className="today-view">
        <div className="today-view__head">
          <h2 className="today-view__title">Hoy · {todayLabel}</h2>
          <button className="btn btn--ghost today-view__close-btn" onClick={() => setCashOpen(true)}>
            🧾 Cerrar el día
          </button>
        </div>
        <div className="today-empty">
          <span className="today-empty__emoji">🎾</span>
          <p>No tenés turnos hoy. ¡A descansar o a sumar alumnos!</p>
        </div>
        {cashOpen && <CashCloseModal onClose={() => setCashOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="today-view">
      <div className="today-view__head">
        <h2 className="today-view__title">Hoy · {todayLabel}</h2>
        <button className="btn btn--ghost today-view__close-btn" onClick={() => setCashOpen(true)}>
          🧾 Cerrar el día
        </button>
      </div>

      {/* Saludo de cumpleaños de los alumnos que vienen hoy. */}
      {bdayNames.length > 0 && (
        <div className="today-bday-banner">🎂 Hoy cumple años: <strong>{bdayNames.join(', ')}</strong> — ¡saludalo!</div>
      )}

      {/* Huecos libres del día: tocá uno para meter a alguien en esa hora. */}
      {freeSlots.length > 0 && (
        <div className="today-free">
          <span className="today-free__label">Huecos libres:</span>
          {freeSlots.map((h) => (
            <button key={h} type="button" className="today-free__slot" onClick={() => onNewClass(h * 60)}>
              {minutesToLabel(h * 60)}
            </button>
          ))}
        </div>
      )}

      <div className="today-list">
        {classes.map(({ start, entry }) => {
          const state = classState(entry);
          const chargeable = isChargeable(entry);
          const status = classStatus(ledger, today, start);
          const acc = ledger.byClass[classKey(today, start)];
          const moneyNote = stateMoneyNote(state);
          const isNext = start === nextStart;
          const canCollect = chargeable && status !== 'pagada' && status !== 'sin-seguimiento';

          return (
            <div
              key={start}
              className={`today-card today-card--${status}${isNext ? ' today-card--next' : ''}${
                state === 'cancelada' ? ' today-card--cancelada' : ''
              }`}
            >
              {/* Cabecera tocable: entra al turno. */}
              <button className="today-card__head" onClick={() => onOpenClass(start, entry)}>
                <span className="today-card__time">{classRangeLabel(start, entry)}</span>
                {isNext && <span className="today-card__next-tag">Próximo</span>}
                <span className={`badge badge--${entry.type}`}>{CLASS_TYPE_LABEL[entry.type]}</span>
                {state !== 'confirmada' && (
                  <span className={`chip chip--state-${state}`}>
                    {STATE_LABEL[state]}
                    {moneyNote && <span className={`state-note state-note--${moneyNote.kind}`}> — {moneyNote.text}</span>}
                  </span>
                )}
                {chargeable && <span className={`chip chip--status-${status}`}>{STATUS_LABEL[status]}</span>}
                <span className="today-card__open" aria-hidden>
                  ›
                </span>
              </button>

              {/* Alumnos: nombre, deuda (si tiene), y asistencia de un toque. */}
              <div className="today-card__students">
                {entry.participants.map((p, idx) => {
                  // Deuda del alumno para tenerla presente al atenderlo: "debe N clases · $X".
                  const debt = p.studentId ? studentDebt(ledger, p.studentId) : { amount: 0, classes: 0 };
                  const owes = debt.amount > 0.5;
                  const student = p.studentId ? data.students[p.studentId] : undefined;
                  const birthday = student ? isBirthdayOn(student, today) : false;
                  return (
                    <div key={idx} className="today-line">
                      <span className="today-line__name">{participantName(p, data.students)}</span>
                      {birthday && (
                        <span className="today-line__bday" title="¡Cumple años hoy!">
                          🎂 ¡cumple!
                        </span>
                      )}
                      {owes && (
                        <span className="today-line__debt" title="Este alumno debe plata">
                          debe{debt.classes > 0 ? ` ${debt.classes} ${debt.classes === 1 ? 'clase' : 'clases'} ·` : ''}{' '}
                          {formatCurrency(debt.amount)}
                        </span>
                      )}
                      {/* Botones "Pagado: Sí / No" por alumno (mismo componente que en las otras vistas). */}
                      <PaymentToggle day={today} start={start} studentId={p.studentId} />
                      {/* La asistencia es solo un registro: no cambia la plata. */}
                      <AttendanceToggle attended={p.attended} onChange={(a) => setAttendance(today, start, idx, a)} />
                    </div>
                  );
                })}
              </div>

              {/* Acción rápida: cobrar el turno con el medio por defecto. */}
              {canCollect && (
                <div className="today-card__actions">
                  <button className="btn btn--primary today-card__collect" onClick={() => quickCollectClass(today, start)}>
                    💵 Cobrar {formatCurrency(acc?.pending ?? entry.price)}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {cashOpen && <CashCloseModal onClose={() => setCashOpen(false)} />}
    </div>
  );
}
