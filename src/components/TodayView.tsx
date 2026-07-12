import { useEffect, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { dayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayEntries, classStatus, STATUS_LABEL, classKey } from '../lib/money';
import { participantName } from '../lib/students';
import { classDuration, classState, isChargeable, STATE_LABEL, stateMoneyNote } from '../lib/classMeta';
import { classRangeLabel } from '../lib/time';
import AttendanceToggle from './AttendanceToggle';
import CashCloseModal from './CashCloseModal';
import type { ClassEntry } from '../types';

interface TodayViewProps {
  /** Entrar al turno (abre el formulario de la clase). */
  onOpenClass: (start: number, entry: ClassEntry) => void;
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
export default function TodayView({ onOpenClass }: TodayViewProps) {
  const { data, ledger, quickCollectClass, setAttendance } = useAgenda();
  const [cashOpen, setCashOpen] = useState(false);
  // Se refresca cada minuto para que el "próximo turno" se vaya moviendo solo.
  const [nowMin, setNowMin] = useState(() => currentMinutes());
  useEffect(() => {
    const id = window.setInterval(() => setNowMin(currentMinutes()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const today = dayKey(new Date());
  const classes = dayEntries(data.days[today]); // ya ordenadas por hora de inicio
  // Próximo turno: el primero (no cancelado) que todavía no terminó (en curso o por venir).
  const nextStart = classes.find((c) => isChargeable(c.entry) && c.start + classDuration(c.entry) > nowMin)?.start;

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
                <span className={`badge badge--${entry.type}`}>
                  {entry.type === 'grupal' ? 'Grupal' : 'Individual'}
                </span>
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
                  const balance = p.studentId ? ledger.byStudent[p.studentId]?.balance ?? 0 : 0;
                  const owes = balance > 0.5;
                  return (
                    <div key={idx} className="today-line">
                      <span className="today-line__name">{participantName(p, data.students)}</span>
                      {owes && (
                        <span className="today-line__debt" title="Este alumno debe plata">
                          debe {formatCurrency(balance)}
                        </span>
                      )}
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
