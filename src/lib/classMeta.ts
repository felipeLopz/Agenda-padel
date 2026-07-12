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

// Nota (v10): el cálculo de solapamiento por rango real (y las etiquetas de horario) vive
// en lib/time.ts: `computeDayOverlaps`, `findOverlapStart`, `nextFreeStart`, `classRangeLabel`.
