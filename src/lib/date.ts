import type { DayKey } from '../types';

/**
 * Genera la clave de día "AÑO-MES-DIA" (mes desde 0), el mismo formato
 * usado por el prototipo original, para que los JSON importados encajen
 * directamente sin conversión.
 */
export function dayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m, d);
}

/**
 * Fecha ISO "YYYY-MM-DD" (la que devuelve un <input type="date">) → clave de día
 * "AÑO-MES0-DIA". Es el inverso de `dayKeyToISO` (en money.ts).
 */
export function isoToDayKey(iso: string): DayKey {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${(m || 1) - 1}-${d || 1}`;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Lunes de la semana que contiene `date` (semana de lunes a domingo). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
