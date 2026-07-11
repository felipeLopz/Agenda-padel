import { Fragment, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { HOURS, WEEKDAY_NAMES_LONG } from '../lib/constants';
import { addDays, dayKey, isToday, startOfWeek } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus } from '../lib/money';
import { participantName } from '../lib/students';
import { classDuration, classState, isHourBlocked, timeRange } from '../lib/classMeta';
import { holidayName } from '../lib/holidays';
import type { ClassEntry } from '../types';

interface WeeklyViewProps {
  anchor: Date;
  onChangeAnchor: (d: Date) => void;
  onOpenNewClass: (day: string, hour: number) => void;
  onOpenEditClass: (day: string, hour: number, entry: ClassEntry) => void;
  onOpenCopyWeek: (fromMonday: Date) => void;
  onBlockDay: (day: string) => void;
}

/** Vista semanal: grilla de 7 días (columnas) x horas 7-16 (filas). */
export default function WeeklyView({
  anchor,
  onChangeAnchor,
  onOpenNewClass,
  onOpenEditClass,
  onOpenCopyWeek,
  onBlockDay,
}: WeeklyViewProps) {
  const { data, ledger, moveClass } = useAgenda();
  const monday = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [showFree, setShowFree] = useState(false);
  // Origen del arrastre (para reprogramar moviendo).
  const [drag, setDrag] = useState<{ day: string; hour: number } | null>(null);

  function goToWeek(offsetWeeks: number) {
    onChangeAnchor(addDays(anchor, offsetWeeks * 7));
  }

  function handleDrop(day: string, hour: number) {
    if (!drag) return;
    const ok = moveClass(drag, { day, hour });
    if (!ok) alert('Ya hay una clase en esa franja.');
    setDrag(null);
  }

  return (
    <div className="weekly-view">
      <div className="weekly-view__nav">
        <button className="btn btn--ghost" onClick={() => goToWeek(-1)}>
          ← Semana anterior
        </button>
        <button className="btn" onClick={() => onChangeAnchor(new Date())}>
          Hoy
        </button>
        <button className="btn btn--ghost" onClick={() => goToWeek(1)}>
          Semana siguiente →
        </button>
        <button className="btn btn--ghost" onClick={() => onOpenCopyWeek(monday)}>
          ⧉ Copiar semana
        </button>
        <button
          className={`btn btn--ghost${showFree ? ' btn--active' : ''}`}
          onClick={() => setShowFree((v) => !v)}
        >
          {showFree ? '✓ Huecos libres' : 'Ver huecos'}
        </button>
      </div>

      <div className="week-grid">
        <div className="week-grid__corner" />
        {weekDays.map((date) => {
          const key = dayKey(date);
          const total = dayTotals(data, ledger, key);
          const holiday = holidayName(key);
          const block = data.blocks[key];
          return (
            <div key={key} className={`week-grid__head${isToday(date) ? ' week-grid__head--today' : ''}`}>
              <span className="week-grid__head-dow">{WEEKDAY_NAMES_LONG[date.getDay()]}</span>
              <span className="week-grid__head-date">
                {date.getDate()}/{date.getMonth() + 1}
              </span>
              <span className="week-grid__head-total">{formatCurrency(total.total)}</span>
              <div className="week-grid__head-marks">
                {holiday && <span className="mark mark--holiday" title={`Feriado: ${holiday}`}>🎉</span>}
                {block?.fullDay && <span className="mark mark--block" title={block.reason || 'Día bloqueado'}>🚫</span>}
                <button className="mark mark--btn" title="Bloquear / liberar" onClick={() => onBlockDay(key)}>
                  🔒
                </button>
              </div>
            </div>
          );
        })}

        {HOURS.map((hour) => (
          <Fragment key={hour}>
            <div className="week-grid__hour">{hour}:00</div>
            {weekDays.map((date) => {
              const key = dayKey(date);
              const entry = data.days[key]?.[String(hour)];
              const blocked = isHourBlocked(data.blocks[key], hour);

              if (!entry) {
                return (
                  <button
                    key={`${key}-${hour}`}
                    className={`week-cell week-cell--empty${blocked ? ' week-cell--blocked' : ''}${
                      showFree && !blocked ? ' week-cell--free' : ''
                    }`}
                    onClick={() => onOpenNewClass(key, hour)}
                    onDragOver={(e) => {
                      if (drag) e.preventDefault();
                    }}
                    onDrop={() => handleDrop(key, hour)}
                  >
                    <span className="week-cell__add">{blocked ? '🚫' : '+'}</span>
                  </button>
                );
              }

              const status = classStatus(ledger, key, hour);
              const state = classState(entry);
              const dur = classDuration(entry);
              // Altura proporcional de la barrita de duración (60 min = base).
              const durPct = Math.min(200, Math.max(50, (dur / 60) * 100));
              return (
                <button
                  key={`${key}-${hour}`}
                  className={`week-cell week-cell--${entry.type} week-cell--${status} week-cell--state-${state}`}
                  draggable
                  onDragStart={() => setDrag({ day: key, hour })}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => onOpenEditClass(key, hour, entry)}
                >
                  <span className="week-cell__dur-bar" style={{ height: `${durPct}%` }} />
                  <span className="week-cell__type">
                    {entry.type === 'grupal' ? 'Grupal' : 'Individual'}
                    {state !== 'confirmada' && <span className="week-cell__state"> · {state}</span>}
                  </span>
                  <span className="week-cell__names">
                    {entry.type === 'grupal'
                      ? `${entry.participants.length} alumnos`
                      : entry.participants[0]
                        ? participantName(entry.participants[0], data.students)
                        : '—'}
                  </span>
                  <span className="week-cell__meta">
                    {dur !== 60 && <span className="week-cell__range">{timeRange(hour, entry)}</span>}
                    <span className="week-cell__price">{formatCurrency(entry.price)}</span>
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
