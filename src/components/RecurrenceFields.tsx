import { useEffect, useState } from 'react';
import NumberInput from './NumberInput';
import { parseDayKey } from '../lib/date';
import type { RecurrenceInput } from '../lib/recurrence';

/** Fecha ISO "YYYY-MM-DD" a N semanas de un dayKey (para la fecha de fin por defecto). */
function isoWeeksAhead(startDay: string, weeks: number): string {
  const d = parseDayKey(startDay);
  d.setDate(d.getDate() + weeks * 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface RecurrenceFieldsProps {
  /** Día de inicio de la serie (para calcular la fecha de fin por defecto). */
  startDay: string;
  /** Emite la recurrencia armada cada vez que cambia algún campo (setState estable del padre). */
  onChange: (recurrence: RecurrenceInput) => void;
}

/**
 * Campos de recurrencia (cada X semanas, hasta una fecha o una cantidad de clases). Es la
 * MISMA interfaz que se usa al crear una clase recurrente desde cero y al convertir un turno
 * ya existente en serie, para que la experiencia sea idéntica y no haya dos formas distintas.
 * Arma un `RecurrenceInput` —la forma que ya consume la lógica de recurrencia— y lo emite.
 */
export default function RecurrenceFields({ startDay, onChange }: RecurrenceFieldsProps) {
  const [everyWeeks, setEveryWeeks] = useState(1);
  const [endType, setEndType] = useState<'count' | 'date'>('count');
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState(() => isoWeeksAhead(startDay, 4));

  // Cada cambio (o el montaje) arma el RecurrenceInput y lo emite al padre. `onChange` es un
  // setState estable, así que no hace falta incluirlo en las dependencias del efecto.
  useEffect(() => {
    onChange({
      everyWeeks: Math.max(1, everyWeeks),
      end: endType === 'count' ? { type: 'count', count } : { type: 'date', date: endDate },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyWeeks, endType, count, endDate]);

  return (
    <div className="recurrence">
      <div className="recurrence__row">
        <span>Cada</span>
        <NumberInput min={1} value={everyWeeks} onChange={setEveryWeeks} />
        <span>semana(s)</span>
      </div>
      <div className="recurrence__row">
        <select className="select" value={endType} onChange={(e) => setEndType(e.target.value as 'count' | 'date')}>
          <option value="count">Cantidad de clases</option>
          <option value="date">Hasta una fecha</option>
        </select>
        {endType === 'count' ? (
          <NumberInput min={1} value={count} onChange={setCount} />
        ) : (
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        )}
      </div>
    </div>
  );
}
