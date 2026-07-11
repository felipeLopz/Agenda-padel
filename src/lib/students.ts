import type { AgendaData, ClassEntry, ClassParticipant, Student, StudentLevel } from '../types';

/** Etiquetas legibles de cada nivel, en el orden en que se muestran. */
export const LEVEL_LABELS: Record<StudentLevel, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
  competicion: 'Competición',
};

export const LEVELS: StudentLevel[] = ['principiante', 'intermedio', 'avanzado', 'competicion'];

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
 * Sugerencias para el autocompletado al cargar una clase: alumnos activos cuyo
 * nombre contiene el texto, ordenados alfabéticamente. Excluye los ids ya elegidos.
 */
export function suggestStudents(
  query: string,
  students: Record<string, Student>,
  excludeIds: string[] = [],
  limit = 6
): Student[] {
  const q = normalizeName(query);
  const list = Object.values(students)
    .filter((s) => s.active && !excludeIds.includes(s.id))
    .filter((s) => (q ? normalizeName(displayName(s)).includes(q) : true))
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));
  return list.slice(0, limit);
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
    level: 'principiante',
    tags: [],
    active: true,
    createdAt: new Date().toISOString(),
  };
}
