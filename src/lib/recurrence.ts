// Generación de fechas de una serie de clases recurrentes.
// La recurrencia se "materializa": genera clases reales en la agenda (cada una con
// el mismo `seriesId`), en vez de guardarse como una regla que se evalúa después.

import { addDays, dayKey, parseDayKey } from './date';

/** Unidad del período cuando se repite "durante X meses / X años". */
export type PeriodUnit = 'month' | 'year';

export type RecurrenceEnd =
  | { type: 'date'; date: string } // hasta una fecha (ISO "YYYY-MM-DD"), inclusive
  | { type: 'count'; count: number } // una cantidad de repeticiones (incluye la primera)
  // Durante un período: mismo día de semana y misma hora, todas las semanas, desde la
  // clase original hasta cubrir N meses (Mensual) o N años (Anual). Es solo otra forma
  // de decir "hasta cuándo": por dentro se resuelve a una fecha tope y se reusa el
  // mismo recorrido semanal que `type: 'date'` (ver seriesDayKeys).
  | { type: 'period'; unit: PeriodUnit; amount: number };

export interface RecurrenceInput {
  /** Cada cuántas semanas se repite (1 = semanal, 2 = cada 2 semanas, ...). */
  everyWeeks: number;
  end: RecurrenceEnd;
}

/** Tope duro para no generar series infinitas por error. */
const MAX_OCCURRENCES = 260; // ~5 años en frecuencia semanal

/** Topes de los períodos, para que "durante X" no se vaya de rango. */
export const MAX_MONTHS = 60;
export const MAX_YEARS = 5;

/** "YYYY-MM-DD" → timestamp de medianoche local. */
function isoToTime(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/**
 * Fecha tope de un período que arranca en `start`: la misma fecha N meses (o N años)
 * después, inclusive. Si el día no existe en el mes destino (ej: 31 de marzo + 1 mes),
 * se recorta al último día de ese mes (30 de abril), que es lo que espera cualquiera.
 * Usa `setDate(1)` antes de mover el mes para que el Date no se desborde solo.
 */
export function periodEndDate(start: Date, unit: PeriodUnit, amount: number): Date {
  const months = unit === 'year' ? amount * 12 : amount;
  const d = new Date(start);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Último día del mes destino: día 0 del mes siguiente.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Cantidad de un período ya acotada a su tope (1..60 meses, 1..5 años). */
export function clampPeriodAmount(unit: PeriodUnit, amount: number): number {
  const max = unit === 'year' ? MAX_YEARS : MAX_MONTHS;
  return Math.min(Math.max(1, Math.round(amount || 1)), max);
}

/**
 * Devuelve las claves de día de todas las ocurrencias de la serie, empezando por
 * `startDay` (incluida). La hora es la misma en todas, así que no se maneja acá.
 */
export function seriesDayKeys(startDay: string, input: RecurrenceInput): string[] {
  const step = Math.max(1, Math.round(input.everyWeeks)) * 7;
  const start = parseDayKey(startDay);
  const keys: string[] = [];

  if (input.end.type === 'count') {
    const count = Math.min(Math.max(1, Math.round(input.end.count)), MAX_OCCURRENCES);
    for (let i = 0; i < count; i++) {
      keys.push(dayKey(addDays(start, i * step)));
    }
  } else {
    // Fin por fecha o por período: los dos terminan en un timestamp tope y recorren
    // las semanas igual. El período se resuelve acá a su fecha de fin.
    const endTime =
      input.end.type === 'date'
        ? isoToTime(input.end.date)
        : periodEndDate(start, input.end.unit, clampPeriodAmount(input.end.unit, input.end.amount)).getTime();
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const date = addDays(start, i * step);
      if (date.getTime() > endTime) break;
      keys.push(dayKey(date));
    }
  }

  return keys;
}
