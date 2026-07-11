// Helpers de metadatos de clase (v4): duración, estado de agenda y bloqueos.
// Todo con defaults para mantener compatibilidad con datos v3 (sin estos campos).

import type { ClassEntry, ClassState, DayBlock } from '../types';

/** Duración en minutos (default 60 si la clase no la tiene, como en v3). */
export function classDuration(entry: ClassEntry): number {
  return entry.duration && entry.duration > 0 ? entry.duration : 60;
}

/** Estado de agenda (default 'confirmada'). */
export function classState(entry: ClassEntry): ClassState {
  return entry.state ?? 'confirmada';
}

/** ¿La clase genera plata? Las canceladas no (no cuentan deuda ni facturación). */
export function isChargeable(entry: ClassEntry): boolean {
  return classState(entry) !== 'cancelada';
}

export const STATE_LABEL: Record<ClassState, string> = {
  confirmada: 'Confirmada',
  tentativa: 'Tentativa',
  cancelada: 'Cancelada',
  ausente: 'Ausente',
};

export const STATES: ClassState[] = ['confirmada', 'tentativa', 'cancelada', 'ausente'];

/**
 * Aclaración de cobro según el estado, para que quede explícito en la interfaz y
 * no se confundan "ausente" (se cobra igual) con "cancelada" (no se cobra).
 */
export function stateMoneyNote(state: ClassState): { text: string; kind: 'cobra' | 'no-cobra' } | null {
  if (state === 'ausente') return { text: 'se cobra igual', kind: 'cobra' };
  if (state === 'cancelada') return { text: 'no se cobra', kind: 'no-cobra' };
  return null;
}

/** Rango horario legible de una clase, ej "10:00–11:30". */
export function timeRange(hour: number, entry: ClassEntry): string {
  const dur = classDuration(entry);
  const startMin = hour * 60;
  const endMin = startMin + dur;
  const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return `${fmt(startMin)}–${fmt(endMin)}`;
}

/** ¿Está bloqueada esta hora de este día? (día completo o esa hora puntual) */
export function isHourBlocked(block: DayBlock | undefined, hour: number): boolean {
  if (!block) return false;
  return Boolean(block.fullDay) || (block.hours?.includes(hour) ?? false);
}

/** ¿El día está bloqueado en al menos una franja o completo? */
export function isDayBlocked(block: DayBlock | undefined): boolean {
  if (!block) return false;
  return Boolean(block.fullDay) || (block.hours?.length ?? 0) > 0;
}

/** Normaliza un bloque: lo deja "vacío" (null) si no bloquea nada. */
export function cleanBlock(block: DayBlock): DayBlock | null {
  const hours = (block.hours ?? []).filter((h) => Number.isFinite(h));
  if (!block.fullDay && hours.length === 0) return null;
  return {
    fullDay: block.fullDay || undefined,
    hours: block.fullDay ? undefined : hours,
    reason: block.reason?.trim() || undefined,
  };
}

// ---------------------------------------------------------------------------
// Solapamiento de horarios (por duración). Es solo un aviso informativo: no
// bloquea nada ni toca la plata.
// ---------------------------------------------------------------------------

/** Intervalo [inicio, fin) de una clase en minutos desde medianoche. */
function classInterval(hour: number, entry: ClassEntry): [number, number] {
  const start = hour * 60;
  return [start, start + classDuration(entry)];
}

/** ¿Se pisan dos intervalos [a) y [b)? */
function intervalsOverlap(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * Devuelve el conjunto de horas del día cuyas clases se solapan con al menos otra.
 * Las clases canceladas se ignoran (no ocupan horario).
 */
export function computeDayOverlaps(slots: Record<string, ClassEntry> | undefined): Set<number> {
  const overlapping = new Set<number>();
  if (!slots) return overlapping;
  const items = Object.entries(slots)
    .filter(([, e]) => classState(e) !== 'cancelada')
    .map(([h, e]) => ({ hour: Number(h), interval: classInterval(Number(h), e) }));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (intervalsOverlap(items[i].interval, items[j].interval)) {
        overlapping.add(items[i].hour);
        overlapping.add(items[j].hour);
      }
    }
  }
  return overlapping;
}

/**
 * Busca una clase existente del día que se pise con una candidata (hora + duración).
 * Sirve para avisar antes de guardar. Ignora la propia franja (`excludeHour`) y las
 * clases canceladas. Devuelve la hora de la que se pisa, o null si no hay solapamiento.
 */
export function findOverlapFor(
  slots: Record<string, ClassEntry> | undefined,
  hour: number,
  duration: number,
  excludeHour?: number
): number | null {
  if (!slots) return null;
  const candidate: [number, number] = [hour * 60, hour * 60 + (duration > 0 ? duration : 60)];
  for (const [h, entry] of Object.entries(slots)) {
    const other = Number(h);
    if (other === hour || other === excludeHour) continue;
    if (classState(entry) === 'cancelada') continue;
    if (intervalsOverlap(candidate, classInterval(other, entry))) return other;
  }
  return null;
}
