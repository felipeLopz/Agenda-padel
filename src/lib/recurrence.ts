// Generación de fechas de una serie de clases recurrentes.
// La recurrencia se "materializa": genera clases reales en la agenda (cada una con
// el mismo `seriesId`), en vez de guardarse como una regla que se evalúa después.

import { addDays, dayKey, parseDayKey } from './date';

export type RecurrenceEnd =
  | { type: 'date'; date: string } // hasta una fecha (ISO "YYYY-MM-DD"), inclusive
  | { type: 'count'; count: number }; // una cantidad de repeticiones (incluye la primera)

export interface RecurrenceInput {
  /** Cada cuántas semanas se repite (1 = semanal, 2 = cada 2 semanas, ...). */
  everyWeeks: number;
  end: RecurrenceEnd;
}

/** Tope duro para no generar series infinitas por error. */
const MAX_OCCURRENCES = 104; // ~2 años en frecuencia semanal

/** "YYYY-MM-DD" → timestamp de medianoche local. */
function isoToTime(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
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
    const endTime = isoToTime(input.end.date);
    for (let i = 0; i < MAX_OCCURRENCES; i++) {
      const date = addDays(start, i * step);
      if (date.getTime() > endTime) break;
      keys.push(dayKey(date));
    }
  }

  return keys;
}
