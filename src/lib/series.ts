// Series vivas (v15): turnos fijos semanales guardados como REGLA, no generados por
// adelantado. Reemplaza al viejo lib/recurrence.ts (que materializaba N clases de una).
//
// LA IDEA CENTRAL, y por qué la plata no se rompe:
//
//   El pasado es REAL, el futuro es VIRTUAL.
//
//   - Las repeticiones ya vencidas se convierten en clases reales hasta hoy
//     (`rollForwardSeries`, que corre al abrir la app). O sea: `data.days` sigue
//     conteniendo TODO el pasado y el presente, igual que antes de v15.
//   - Las repeticiones futuras NO existen como filas: se calculan al vuelo para mostrarlas
//     (`slotsForDay`) y desaparecen si la serie se corta.
//
// Gracias a eso, computeLedger / stats / report / recordatorios / búsqueda siguen leyendo
// `data.days` y NO se tocaron: la deuda nace de clases reales, como siempre. Si en cambio
// las repeticiones futuras entraran al cálculo, cada alumno debería plata por todas sus
// clases hasta el fin de los tiempos.
//
// Regla del profe: la clase se cobra igual salvo que el alumno avise con tiempo. Eso ya
// funciona solo: la repetición vencida se vuelve clase real y se cobra; si avisó, el profe
// la marca `cancelada` e `isChargeable` la saca de la plata.

import type { AgendaData, ClassEntry, ClassSeries, DaySlots } from '../types';
import { addDays, dayKey, parseDayKey } from './date';

/** Tope de repeticiones que materializa una sola pasada (por si la app no se abre por años). */
const MAX_ROLL_FORWARD = 400;

/** Tope de días que expande una vista de una sola vez (la anual pide ~366). */
const MAX_EXPAND_DAYS = 400;

/** Clase mostrada en la agenda que todavía NO existe como fila: viene de una serie viva. */
export interface VirtualFlag {
  /** Marca de instancia virtual (repetición futura aún no materializada). */
  virtual?: true;
}

/** Compara dos claves de día por FECHA REAL. */
export function dayKeyTime(key: string): number {
  return parseDayKey(key).getTime();
}

/**
 * ¿La serie cae este día?
 *
 * OJO con la comparación de fechas: la clave de día es "año-mes0-día" SIN ceros a la
 * izquierda ("2026-7-3"), así que comparar como TEXTO ordena mal ("2026-7-5" > "2026-7-30")
 * y podría dejar afuera o incluir días equivocados. Siempre por timestamp.
 */
export function seriesOccursOn(series: ClassSeries, key: string): boolean {
  const date = parseDayKey(key);
  if (date.getDay() !== series.weekday) return false;
  const t = date.getTime();
  if (t < dayKeyTime(series.startDay)) return false; // todavía no había empezado
  if (series.until && t >= dayKeyTime(series.until)) return false; // cortada desde esa fecha
  if (series.skips?.some((s) => dayKeyTime(s) === t)) return false; // repetición borrada a mano
  return true;
}

/** Arma la clase (virtual) que la serie dicta ese día, a partir de su molde. */
export function instanceFromSeries(series: ClassSeries): ClassEntry & VirtualFlag {
  return {
    type: series.template.type,
    participants: series.template.participants,
    price: series.template.price,
    duration: series.template.duration,
    content: series.template.content,
    seriesId: series.id,
    virtual: true,
  };
}

/**
 * Clases de un día para MOSTRAR: las reales de `data.days` más las repeticiones virtuales
 * de las series vivas. La clase REAL siempre gana sobre la virtual (es la "excepción":
 * apenas el profe toca una repetición, se materializa y manda ella).
 *
 * Este es el único punto por donde las vistas ven las series vivas. Las funciones que
 * calculan plata siguen leyendo `data.days` directo, a propósito.
 */
export function slotsForDay(data: AgendaData, key: string): DaySlots | undefined {
  const real = data.days[key];
  const list = Object.values(data.series ?? {}).filter((s) => seriesOccursOn(s, key));
  if (list.length === 0) return real;

  let merged: DaySlots | undefined;
  for (const series of list) {
    const slot = String(series.start);
    // Ya hay una clase real en esa franja: manda la real, la virtual ni aparece. Cubre
    // tanto la instancia ya materializada como una clase suelta que ocupe el lugar.
    if (real?.[slot]) continue;
    merged ??= { ...(real ?? {}) };
    merged[slot] = instanceFromSeries(series);
  }
  return merged ?? real;
}

/** ¿Esta clase es una repetición virtual (todavía sin fila propia)? */
export function isVirtual(entry: ClassEntry | undefined): boolean {
  return Boolean(entry && (entry as ClassEntry & VirtualFlag).virtual);
}

/** Saca la marca `virtual` para poder guardar la clase como fila real. */
export function toRealEntry(entry: ClassEntry & VirtualFlag): ClassEntry {
  const { virtual: _virtual, ...rest } = entry;
  return rest;
}

/**
 * Fechas en que la serie cae dentro de [fromKey, toKey], ambas inclusive.
 * Solo LEE: sirve para contar y para materializar.
 */
export function seriesDaysInRange(series: ClassSeries, fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const from = parseDayKey(fromKey);
  const to = dayKeyTime(toKey);
  // Arranca en el primer día del rango que caiga en el día de semana de la serie.
  const delta = (series.weekday - from.getDay() + 7) % 7;
  let cursor = addDays(from, delta);
  for (let i = 0; i < MAX_EXPAND_DAYS && cursor.getTime() <= to; i++) {
    const key = dayKey(cursor);
    if (seriesOccursOn(series, key)) out.push(key);
    cursor = addDays(cursor, 7);
  }
  return out;
}

/** Una repetición vencida lista para convertirse en fila real. */
export interface PendingInstance {
  seriesId: string;
  day: string;
  start: number;
  entry: ClassEntry;
}

/**
 * Repeticiones YA VENCIDAS que todavía no son filas reales, hasta `todayKey` inclusive.
 * Es la función que mantiene la plata igual que antes de v15: lo que ya pasó existe de
 * verdad y se cobra.
 *
 * Es IDEMPOTENTE por dos motivos, a propósito (uno solo no alcanza):
 *  1) arranca desde `materializedUntil`, así que no vuelve a mirar lo ya resuelto;
 *  2) igual saltea cualquier franja que YA tenga una clase real, así que aunque el sello
 *     se pierda o venga de un backup viejo, nunca duplica ni pisa una clase existente.
 */
export function pendingInstances(data: AgendaData, todayKey: string): PendingInstance[] {
  const out: PendingInstance[] = [];
  const todayTime = dayKeyTime(todayKey);
  for (const series of Object.values(data.series ?? {})) {
    // Desde el día siguiente al último materializado (o desde el inicio si nunca corrió).
    const fromTime = Math.max(dayKeyTime(series.materializedUntil) + 86400000, dayKeyTime(series.startDay));
    if (fromTime > todayTime) continue;
    const days = seriesDaysInRange(series, dayKey(new Date(fromTime)), todayKey);
    for (const day of days.slice(0, MAX_ROLL_FORWARD)) {
      if (data.days[day]?.[String(series.start)]) continue; // ya hay clase real ahí: no se toca
      // Se guarda como fila real: sin la marca `virtual`, que es solo para mostrar.
      out.push({ seriesId: series.id, day, start: series.start, entry: toRealEntry(instanceFromSeries(series)) });
    }
  }
  return out;
}

/** Fecha de hoy como clave de día. */
export function todayKey(): string {
  return dayKey(new Date());
}
