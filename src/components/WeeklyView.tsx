import { Fragment } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { HOURS, WEEKDAY_NAMES_LONG } from '../lib/constants';
import { addDays, dayKey, isToday, startOfWeek } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus } from '../lib/money';
import { participantName } from '../lib/students';
import type { ClassEntry } from '../types';

interface WeeklyViewProps {
  anchor: Date;
  onChangeAnchor: (d: Date) => void;
  onOpenNewClass: (day: string, hour: number) => void;
  onOpenEditClass: (day: string, hour: number, entry: ClassEntry) => void;
}

/** Vista alternativa: grilla de 7 días (columnas) x horas 7-16 (filas). */
export default function WeeklyView({ anchor, onChangeAnchor, onOpenNewClass, onOpenEditClass }: WeeklyViewProps) {
  const { data, ledger } = useAgenda();
  const monday = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  function goToWeek(offsetWeeks: number) {
    onChangeAnchor(addDays(anchor, offsetWeeks * 7));
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
      </div>

      <div className="week-grid">
        <div className="week-grid__corner" />
        {weekDays.map((date) => {
          const key = dayKey(date);
          const total = dayTotals(data, ledger, key);
          return (
            <div key={key} className={`week-grid__head${isToday(date) ? ' week-grid__head--today' : ''}`}>
              <span className="week-grid__head-dow">{WEEKDAY_NAMES_LONG[date.getDay()]}</span>
              <span className="week-grid__head-date">
                {date.getDate()}/{date.getMonth() + 1}
              </span>
              <span className="week-grid__head-total">{formatCurrency(total.total)}</span>
            </div>
          );
        })}

        {HOURS.map((hour) => (
          <Fragment key={hour}>
            <div className="week-grid__hour">{hour}:00</div>
            {weekDays.map((date) => {
              const key = dayKey(date);
              const entry = data.days[key]?.[String(hour)];
              const status = entry ? classStatus(ledger, key, hour) : null;
              return (
                <button
                  key={`${key}-${hour}`}
                  className={`week-cell${
                    entry ? ` week-cell--${entry.type} week-cell--${status}` : ' week-cell--empty'
                  }`}
                  onClick={() => (entry ? onOpenEditClass(key, hour, entry) : onOpenNewClass(key, hour))}
                >
                  {entry ? (
                    <>
                      <span className="week-cell__type">{entry.type === 'grupal' ? 'Grupal' : 'Individual'}</span>
                      <span className="week-cell__names">
                        {entry.type === 'grupal'
                          ? `${entry.participants.length} alumnos`
                          : entry.participants[0]
                            ? participantName(entry.participants[0], data.students)
                            : '—'}
                      </span>
                      <span className="week-cell__price">{formatCurrency(entry.price)}</span>
                    </>
                  ) : (
                    <span className="week-cell__add">+</span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
