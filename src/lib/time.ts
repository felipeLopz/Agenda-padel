// Helpers de tiempo real (v10). La agenda pasó de "hora entera como clave" a la
// HORA DE INICIO EN MINUTOS desde la medianoche (9:00 = 540, 9:30 = 570), con la
// duración en minutos guardada en la clase. Cada clase ocupa su rango real
// [inicio, inicio + duración). Todas las funciones son puras.

import type { ClassEntry } from '../types';
import { classDuration, classState } from './classMeta';

/** Granularidad de la elección de horario (minutos). 15 = 9:00, 9:15, 9:30... */
export const MINUTE_STEP = 15;

/** Minutos en un día (tope duro para clamear). */
export const DAY_MINUTES = 24 * 60;

/** Redondea unos minutos al múltiplo de MINUTE_STEP más cercano. */
export function snapMinutes(min: number, step: number = MINUTE_STEP): number {
  const s = Math.max(1, step);
  return Math.round(min / s) * s;
}

/** Minutos → etiqueta legible "9:30" (hora sin cero adelante, minutos con dos dígitos). */
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = ((min % 60) + 60) % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Minutos → "HH:MM" (dos dígitos), el valor que espera <input type="time">. */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:MM" (de <input type="time">) → minutos desde medianoche. null si no es válido. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Hora entera (0..23) que contiene un instante en minutos. 570 → 9. */
export function hourOf(min: number): number {
  return Math.floor(min / 60);
}

/** Intervalo [inicio, fin) de una clase, en minutos. */
export function classInterval(start: number, entry: ClassEntry): [number, number] {
  return [start, start + classDuration(entry)];
}

/** Rango legible de una clase, ej "9:30–10:30". */
export function classRangeLabel(start: number, entry: ClassEntry): string {
  const [a, b] = classInterval(start, entry);
  return `${minutesToLabel(a)}–${minutesToLabel(b)}`;
}

/** ¿Se pisan los intervalos [aStart, aStart+aDur) y [bStart, bStart+bDur)? */
export function rangesOverlap(aStart: number, aDur: number, bStart: number, bDur: number): boolean {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/**
 * Busca una clase del día que se pise con una candidata (inicio + duración). Ignora la
 * franja `excludeStart` (para no chocar consigo misma al editar/mover) y las clases
 * canceladas (no ocupan horario). Devuelve el inicio de la que se pisa, o null si está libre.
 */
export function findOverlapStart(
  slots: Record<string, ClassEntry> | undefined,
  start: number,
  duration: number,
  excludeStart?: number
): number | null {
  if (!slots) return null;
  const dur = duration > 0 ? duration : 60;
  for (const [key, entry] of Object.entries(slots)) {
    const other = Number(key);
    if (other === excludeStart) continue;
    if (classState(entry) === 'cancelada') continue;
    if (rangesOverlap(start, dur, other, classDuration(entry))) return other;
  }
  return null;
}

/**
 * Conjunto de inicios (claves) de las clases del día que se pisan con al menos otra.
 * Las canceladas se ignoran. Sirve para marcar visualmente solapamientos que pudieran
 * venir de datos viejos (el modelo nuevo no deja crear/mover a un rango ocupado).
 */
export function computeDayOverlaps(slots: Record<string, ClassEntry> | undefined): Set<number> {
  const overlapping = new Set<number>();
  if (!slots) return overlapping;
  const items = Object.entries(slots)
    .filter(([, e]) => classState(e) !== 'cancelada')
    .map(([k, e]) => ({ start: Number(k), dur: classDuration(e) }));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (rangesOverlap(items[i].start, items[i].dur, items[j].start, items[j].dur)) {
        overlapping.add(items[i].start);
        overlapping.add(items[j].start);
      }
    }
  }
  return overlapping;
}

/**
 * Primer horario libre desde `fromStart` (inclusive) donde una clase de `duration`
 * minutos no se pise con ninguna existente. Si el candidato choca, salta al fin de esa
 * clase y reintenta. Corta al final del día. Útil para sugerir "probá desde las X".
 */
export function nextFreeStart(
  slots: Record<string, ClassEntry> | undefined,
  fromStart: number,
  duration: number,
  excludeStart?: number
): number | null {
  const dur = duration > 0 ? duration : 60;
  let candidate = snapMinutes(fromStart);
  // Como mucho, tantas vueltas como clases haya + un margen.
  const guard = (slots ? Object.keys(slots).length : 0) + 2;
  for (let i = 0; i <= guard; i++) {
    if (candidate + dur > DAY_MINUTES) return null;
    const conflict = findOverlapStart(slots, candidate, dur, excludeStart);
    if (conflict == null) return candidate;
    const other = slots?.[String(conflict)];
    candidate = snapMinutes(conflict + (other ? classDuration(other) : 60));
  }
  return null;
}
