// Horario de trabajo configurable (v6): franjas por día y días laborales.
// Reemplaza al HOURS fijo. Todo con defaults para compatibilidad con datos v5.

import type { AgendaData, DayBlock, DaySlots, Settings } from '../types';
import { DEFAULT_WORKDAYS, HOURS } from './constants';

/** Opciones de días de la semana (lunes primero), value = Date.getDay(). */
export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

/** Hora de inicio configurada (default 7). */
export function startHour(settings: Settings): number {
  const h = settings.startHour;
  return typeof h === 'number' && h >= 0 && h <= 23 ? h : 7;
}

/** Hora de fin inclusive (default 16). */
export function endHour(settings: Settings): number {
  const h = settings.endHour;
  return typeof h === 'number' && h >= 0 && h <= 23 ? h : 16;
}

/** Franjas del horario configurado (ej: [7..16]). Cae a HOURS si el rango es inválido. */
export function scheduleHours(settings: Settings): number[] {
  const a = startHour(settings);
  const b = endHour(settings);
  if (b < a) return [...HOURS];
  const out: number[] = [];
  for (let h = a; h <= b; h++) out.push(h);
  return out;
}

/** Cantidad de franjas por día (para la ocupación). */
export function slotsPerDay(settings: Settings): number {
  return scheduleHours(settings).length;
}

/** Días laborales configurados (default lunes a viernes). */
export function workDays(settings: Settings): number[] {
  return settings.workDays && settings.workDays.length ? settings.workDays : [...DEFAULT_WORKDAYS];
}

/** ¿La fecha cae en un día laboral? */
export function isWorkday(settings: Settings, date: Date): boolean {
  return workDays(settings).includes(date.getDay());
}

/**
 * Horas a mostrar en la agenda de UN día: la unión del horario configurado con
 * cualquier hora que ya tenga clase o bloqueo (salvaguarda: si achicás el horario,
 * no se esconde una clase vieja que quedó fuera de rango). La clave de cada clase está
 * en minutos (v10): se convierte a su HORA (bucket) para saber en qué fila mostrarla.
 */
export function displayHoursForDay(
  settings: Settings,
  slots: DaySlots | undefined,
  block?: DayBlock
): number[] {
  const set = new Set(scheduleHours(settings));
  if (slots) for (const startStr of Object.keys(slots)) set.add(Math.floor(Number(startStr) / 60));
  if (block?.hours) for (const h of block.hours) set.add(h);
  return [...set].sort((a, b) => a - b);
}

/** Horas a mostrar en la grilla semanal: horario + cualquier hora con clase en la semana. */
export function displayHoursForDays(settings: Settings, data: AgendaData, dayKeys: string[]): number[] {
  const set = new Set(scheduleHours(settings));
  for (const key of dayKeys) {
    const slots = data.days[key];
    if (slots) for (const startStr of Object.keys(slots)) set.add(Math.floor(Number(startStr) / 60));
  }
  return [...set].sort((a, b) => a - b);
}

/** Cantidad de días laborales en un período (mes 0-indexado, o todo el año si month=null). */
export function countWorkdaysInPeriod(settings: Settings, year: number, month: number | null): number {
  const wd = workDays(settings);
  const months = month != null ? [month] : Array.from({ length: 12 }, (_, i) => i);
  let count = 0;
  for (const m of months) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      if (wd.includes(new Date(year, m, d).getDay())) count += 1;
    }
  }
  return count;
}
