import type { AgendaData, ClassEntry, ClassParticipant, PadelCategory, PadelRank, Student } from '../types';
import { parseDayKey } from './date';

/** Categorías de pádel disponibles (1ra = la más alta … 8va). */
export const PADEL_CATEGORIES: PadelCategory[] = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'];

/** Etiqueta legible de una categoría (por ahora, el mismo texto: "3ra"). */
export const CATEGORY_LABELS: Record<PadelCategory, string> = {
  '1ra': '1ra',
  '2da': '2da',
  '3ra': '3ra',
  '4ta': '4ta',
  '5ta': '5ta',
  '6ta': '6ta',
  '7ma': '7ma',
  '8va': '8va',
};

/** Niveles dentro de la categoría. */
export const PADEL_RANKS: PadelRank[] = ['baja', 'media', 'alta'];

/** Etiquetas legibles de cada nivel. */
export const RANK_LABELS: Record<PadelRank, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

/** Normaliza un nombre para comparar/deduplicar (sin espacios extra, en minúsculas). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Nombre visible de una ficha: "Nombre Apellido" (o lo que haya). */
export function displayName(student: Student): string {
  const full = `${student.firstName} ${student.lastName}`.trim();
  return full || 'Sin nombre';
}

/**
 * Nombre a mostrar de un participante. Prefiere el nombre ACTUAL de la ficha
 * (nombre "en vivo": si se corrige la ficha, se refleja en todo el historial) y
 * cae a `name` guardado si el id no resuelve o si es un nombre suelto.
 */
export function participantName(
  participant: ClassParticipant,
  students: Record<string, Student>
): string {
  if (participant.studentId && students[participant.studentId]) {
    return displayName(students[participant.studentId]);
  }
  return participant.name || '—';
}

/** Lista de nombres de una clase, ya resueltos contra la base de alumnos. */
export function classNames(entry: ClassEntry, students: Record<string, Student>): string[] {
  return entry.participants.map((p) => participantName(p, students));
}

/** Link wa.me a partir de un teléfono. Devuelve null si no hay número usable. */
export function whatsappLink(phone: string | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  // Si parece un número argentino sin código de país (10 dígitos, ej "2613900039"),
  // le anteponemos 549. Si ya trae código de país, se usa tal cual.
  if (digits.length === 10 && !digits.startsWith('54')) {
    digits = '549' + digits;
  }
  return `https://wa.me/${digits}`;
}

/** Cuántas clases tiene vinculadas un alumno (rápido, para la lista). */
export function countStudentClasses(data: AgendaData, studentId: string): number {
  let n = 0;
  for (const slots of Object.values(data.days)) {
    for (const entry of Object.values(slots)) {
      if (entry.participants.some((p) => p.studentId === studentId)) n++;
    }
  }
  return n;
}

/**
 * Puntaje de actividad por alumno (para sugerir primero los que "vienen más seguido /
 * más recientes"). Cada clase suma 1 (frecuencia) + un bonus por recencia (hasta +1 para
 * clases de hoy, decayendo a 0 a los ~90 días). Solo LEE la agenda, no toca nada.
 */
export function studentActivityScore(data: AgendaData): Map<string, number> {
  const now = Date.now();
  const DAY = 86400000;
  const score = new Map<string, number>();
  for (const [day, slots] of Object.entries(data.days)) {
    const ageDays = Math.max(0, (now - parseDayKey(day).getTime()) / DAY);
    const weight = 1 + Math.max(0, 1 - ageDays / 90);
    for (const entry of Object.values(slots)) {
      for (const p of entry.participants) {
        if (p.studentId) score.set(p.studentId, (score.get(p.studentId) ?? 0) + weight);
      }
    }
  }
  return score;
}

/**
 * Sugerencias para el autocompletado al cargar una clase: alumnos activos cuyo nombre
 * contiene el texto. Si se pasa `rank` (ver studentActivityScore), aparecen primero los que
 * vienen más seguido/recién; a igualdad, orden alfabético. Excluye los ids ya elegidos.
 */
export function suggestStudents(
  query: string,
  students: Record<string, Student>,
  excludeIds: string[] = [],
  limit = 6,
  rank?: Map<string, number>
): Student[] {
  const q = normalizeName(query);
  const list = Object.values(students)
    .filter((s) => s.active && !excludeIds.includes(s.id))
    .filter((s) => (q ? normalizeName(displayName(s)).includes(q) : true));
  list.sort((a, b) => {
    const ra = rank?.get(a.id) ?? 0;
    const rb = rank?.get(b.id) ?? 0;
    if (rb !== ra) return rb - ra; // más frecuentes/recientes primero
    return displayName(a).localeCompare(displayName(b), 'es');
  });
  return list.slice(0, limit);
}

/** ¿El alumno cumple años ese día del calendario? Compara mes-día (ignora el año). */
export function isBirthdayOn(student: Student, dayKey: string): boolean {
  if (!student.birthday) return false;
  const [, bm, bd] = student.birthday.split('-').map(Number); // "YYYY-MM-DD" (mes 1-12)
  const [, m, d] = dayKey.split('-').map(Number); // "AÑO-MES0-DIA" (mes 0-11)
  if (!bm || !bd) return false;
  return bm === m + 1 && bd === d;
}

/** Busca una ficha activa cuyo nombre coincide EXACTO con el texto (para no duplicar). */
export function findStudentByName(
  name: string,
  students: Record<string, Student>
): Student | undefined {
  const q = normalizeName(name);
  return Object.values(students).find((s) => normalizeName(displayName(s)) === q);
}

/** Crea una ficha mínima a partir de un nombre suelto (usado al "crear al vuelo"). */
export function makeStudentFromName(id: string, name: string): Student {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? '';
  const lastName = parts.join(' ');
  return {
    id,
    firstName,
    lastName,
    // Categoría/nivel quedan sin definir: el profe los carga a mano en la ficha.
    tags: [],
    active: true,
    createdAt: new Date().toISOString(),
  };
}
