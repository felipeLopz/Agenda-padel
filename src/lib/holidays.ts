// Feriados nacionales de Argentina, calculados por año (no se guardan en los datos).
//
// Incluye los de fecha fija y los movibles derivados de Pascua (Carnaval y Viernes
// Santo), calculada con el algoritmo de Computus (Meeus/Butcher, gregoriano).
// NO incluye los "feriados con fines turísticos" (puentes) ni los traslados de la
// ley 27.399, porque se deciden por decreto cada año y no se pueden calcular. Son
// solo una marca visual: el profesor igual puede dar clases un feriado.

import { dayKey } from './date';

/** Domingo de Pascua del año (gregoriano). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysTo(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const cache = new Map<number, Record<string, string>>();

/**
 * Mapa de feriados del año, indexado por clave de día ("AÑO-MES0-DIA").
 * El valor es el nombre del feriado. Cacheado por año.
 */
export function argentineHolidays(year: number): Record<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const easter = easterSunday(year);
  const out: Record<string, string> = {};

  const fixed: Array<[number, number, string]> = [
    // [mes0, día, nombre]
    [0, 1, 'Año Nuevo'],
    [2, 24, 'Día de la Memoria'],
    [3, 2, 'Veteranos y Caídos en Malvinas'],
    [4, 1, 'Día del Trabajador'],
    [4, 25, 'Revolución de Mayo'],
    [5, 20, 'Paso a la Inmortalidad de Belgrano'],
    [6, 9, 'Día de la Independencia'],
    [11, 8, 'Inmaculada Concepción de María'],
    [11, 25, 'Navidad'],
  ];
  for (const [m, d, name] of fixed) {
    out[dayKey(new Date(year, m, d))] = name;
  }

  // Movibles derivados de Pascua.
  out[dayKey(addDaysTo(easter, -48))] = 'Carnaval';
  out[dayKey(addDaysTo(easter, -47))] = 'Carnaval';
  out[dayKey(addDaysTo(easter, -2))] = 'Viernes Santo';

  return out;
}

/** Nombre del feriado de un día, o null si no es feriado. */
export function holidayName(day: string): string | null {
  const year = Number(day.split('-')[0]);
  if (!Number.isFinite(year)) return null;
  return argentineHolidays(year)[day] ?? null;
}
