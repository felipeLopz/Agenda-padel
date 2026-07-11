import { useAgenda } from '../state/AgendaContext';
import { daysInMonth, dayKey, isToday } from '../lib/date';
import { WEEKDAY_NAMES } from '../lib/constants';
import { formatCurrency } from '../lib/format';
import { monthTotals, dayTotals, dayEntries, classStatus, STATUS_LABEL } from '../lib/money';
import { classNames } from '../lib/students';

interface MonthColumnProps {
  year: number;
  month: number;
  name: string;
  onOpenDay: (day: string) => void;
}

/** Una columna del calendario anual: todos los días de un mes con sus barras de clases. */
export default function MonthColumn({ year, month, name, onOpenDay }: MonthColumnProps) {
  const { data, ledger } = useAgenda();
  const total = monthTotals(data, ledger, year, month);
  const numDays = daysInMonth(year, month);

  return (
    <div className="month-column">
      <div className="month-column__title">{name}</div>
      <div className="month-column__days">
        {Array.from({ length: numDays }, (_, i) => i + 1).map((dayNum) => {
          const date = new Date(year, month, dayNum);
          const key = dayKey(date);
          const slots = data.days[key];
          const dTotal = dayTotals(data, ledger, key);
          const entries = dayEntries(slots);

          return (
            <button
              key={dayNum}
              className={`day-row${isToday(date) ? ' day-row--today' : ''}${
                entries.length === 0 ? ' day-row--empty' : ''
              }`}
              onClick={() => onOpenDay(key)}
            >
              <span className="day-row__num">{dayNum}</span>
              <span className="day-row__dow">{WEEKDAY_NAMES[date.getDay()]}</span>
              <span className="day-row__bars">
                {entries.map(({ hour, entry }) => {
                  const status = classStatus(ledger, key, hour);
                  return (
                    <span
                      key={hour}
                      className={`day-bar day-bar--${entry.type} day-bar--${status}`}
                      style={{ flexGrow: entry.participants.length }}
                      title={`${hour}h · ${
                        classNames(entry, data.students).join(', ') || entry.participants.length + ' alumno(s)'
                      } · ${formatCurrency(entry.price)} · ${STATUS_LABEL[status]}`}
                    />
                  );
                })}
              </span>
              <span className="day-row__total">{dTotal.total > 0 ? formatCurrency(dTotal.total) : ''}</span>
            </button>
          );
        })}
      </div>
      <div className="month-column__footer">
        <span>Total</span>
        <span>{formatCurrency(total.total)}</span>
      </div>
    </div>
  );
}
