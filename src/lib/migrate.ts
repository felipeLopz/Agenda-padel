// Migración de datos y normalización general (v1 → v2 → v3).
//
// v1 (prototipo): clases con `names: string[]`, sin alumnos.
// v2 (Tanda 1): base `students` + clases con `participants` y `paid` por clase.
// v3 (Tanda 2): + pagos, packs, gastos, medios de pago y descuentos; el estado
//   cobrado/pendiente de la clase se DERIVA de los pagos, así que `paid` se elimina.
//
// `normalizeData` (en storage.ts) corre al cargar el localStorage y al importar
// cualquier JSON. La cadena es: normalizeToV2 (maneja v1/v2/v3) → migrateV2toV3.
// Todo es idempotente y no descarta datos: los faltantes se completan por defecto.

import type {
  ClassParticipant,
  ClassState,
  ClassType,
  DayBlock,
  Discount,
  Expense,
  Pack,
  Payment,
  PaymentMethod,
  Prices,
  Settings,
  Student,
  StudentLevel,
  AgendaData,
} from '../types';
import {
  DATA_VERSION,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PRICES,
  DEFAULT_SETTINGS,
  MIGRATED_METHOD_ID,
} from './constants';
import { newId } from './id';
import { applyDiscountChain } from './discount';
import { displayName, makeStudentFromName, normalizeName } from './students';

const VALID_LEVELS: StudentLevel[] = ['principiante', 'intermedio', 'avanzado', 'competicion'];

/** Intermedio v2: como una clase v2, con `paid`, antes de derivar el estado en v3.
 *  Además carga los campos v4 (duración/estado/serie) si el origen los trae. */
interface V2Entry {
  type: ClassType;
  participants: ClassParticipant[];
  price: number;
  paid: boolean;
  duration?: number;
  state?: ClassState;
  seriesId?: string;
}
interface V2Intermediate {
  prices: Prices;
  students: Record<string, Student>;
  days: Record<string, Record<string, V2Entry>>;
}

/** Sanea un descuento externo; devuelve undefined si no es válido. */
function parseDiscount(raw: unknown): Discount | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Partial<Discount>;
  if (d.type !== 'percent' && d.type !== 'fixed') return undefined;
  const value = Number(d.value);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return { type: d.type, value };
}

/** Sanea una ficha que viene de un JSON externo. Devuelve null si es inservible. */
function normalizeStudent(raw: unknown): Student | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<Student>;
  const firstName = typeof s.firstName === 'string' ? s.firstName : '';
  const lastName = typeof s.lastName === 'string' ? s.lastName : '';
  if (!firstName && !lastName) return null;
  return {
    id: typeof s.id === 'string' && s.id ? s.id : newId(),
    firstName,
    lastName,
    photo: typeof s.photo === 'string' ? s.photo : undefined,
    phone: typeof s.phone === 'string' ? s.phone : undefined,
    level: VALID_LEVELS.includes(s.level as StudentLevel) ? (s.level as StudentLevel) : 'principiante',
    birthday: typeof s.birthday === 'string' ? s.birthday : undefined,
    notes: typeof s.notes === 'string' ? s.notes : undefined,
    tags: Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === 'string') : [],
    active: s.active !== false, // por defecto activo
    discount: parseDiscount(s.discount),
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
  };
}

/**
 * Convierte cualquier objeto (v1/v2/v3) en un intermedio v2 (con `paid` por clase).
 * Los datos de plata de v3 (pagos, packs, etc.) se procesan aparte en migrateV2toV3.
 */
function normalizeToV2(raw: unknown): V2Intermediate {
  const src = (raw ?? {}) as {
    prices?: Partial<Prices>;
    students?: Record<string, unknown>;
    days?: Record<string, unknown>;
  };

  const prices: Prices = {
    grupal: Number(src.prices?.grupal) || DEFAULT_PRICES.grupal,
    indiv: Number(src.prices?.indiv) || DEFAULT_PRICES.indiv,
  };

  // 1) Alumnos existentes (v2/v3) + índice nombre→id para vincular sueltos de v1.
  const students: Record<string, Student> = {};
  const nameIndex = new Map<string, string>();
  if (src.students && typeof src.students === 'object') {
    for (const rawStudent of Object.values(src.students)) {
      const student = normalizeStudent(rawStudent);
      if (!student) continue;
      students[student.id] = student;
      nameIndex.set(normalizeName(displayName(student)), student.id);
    }
  }

  function ensureStudentId(name: string): string {
    const key = normalizeName(name);
    const existing = nameIndex.get(key);
    if (existing) return existing;
    const student = makeStudentFromName(newId(), name);
    students[student.id] = student;
    nameIndex.set(key, student.id);
    return student.id;
  }

  // 2) Días y clases. Aceptamos participants (v2/v3) y names (v1).
  const days: V2Intermediate['days'] = {};
  if (src.days && typeof src.days === 'object') {
    for (const [dKey, rawSlots] of Object.entries(src.days)) {
      if (!rawSlots || typeof rawSlots !== 'object') continue;
      const cleanSlots: Record<string, V2Entry> = {};

      for (const [hour, rawEntry] of Object.entries(rawSlots as Record<string, unknown>)) {
        if (!rawEntry || typeof rawEntry !== 'object') continue;
        const entry = rawEntry as {
          type?: unknown;
          participants?: unknown;
          names?: unknown;
          price?: unknown;
          paid?: unknown;
          duration?: unknown;
          state?: unknown;
          seriesId?: unknown;
        };
        const type: ClassType = entry.type === 'indiv' ? 'indiv' : 'grupal';

        let participants: ClassParticipant[] = [];

        if (Array.isArray(entry.participants)) {
          participants = entry.participants
            .map((p): ClassParticipant | null => {
              if (!p || typeof p !== 'object') return null;
              const part = p as Partial<ClassParticipant>;
              const name = typeof part.name === 'string' ? part.name : '';
              const studentId =
                typeof part.studentId === 'string' && students[part.studentId] ? part.studentId : null;
              if (!studentId && !name.trim()) return null;
              return { studentId, name, discount: parseDiscount(part.discount) };
            })
            .filter((p): p is ClassParticipant => p !== null);
        } else if (Array.isArray(entry.names)) {
          participants = entry.names
            .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
            .map((name) => ({ studentId: ensureStudentId(name), name: name.trim() }));
        }

        if (participants.length === 0) continue;
        const finalParticipants = type === 'indiv' ? participants.slice(0, 1) : participants;

        const durationNum = Number(entry.duration);
        const validStates: ClassState[] = ['confirmada', 'tentativa', 'cancelada', 'ausente'];
        cleanSlots[hour] = {
          type,
          participants: finalParticipants,
          price: Number(entry.price) || 0,
          paid: Boolean(entry.paid),
          duration: Number.isFinite(durationNum) && durationNum > 0 ? durationNum : undefined,
          state: validStates.includes(entry.state as ClassState) ? (entry.state as ClassState) : undefined,
          seriesId: typeof entry.seriesId === 'string' ? entry.seriesId : undefined,
        };
      }

      if (Object.keys(cleanSlots).length > 0) days[dKey] = cleanSlots;
    }
  }

  return { prices, students, days };
}

/** Clave de día "AÑO-MES0-DIA" → fecha ISO "YYYY-MM-DD" (para pagos). */
function dayKeyToISO(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Medios de pago desde un JSON externo, o los de fábrica si no hay. */
function normalizeMethods(raw: unknown): PaymentMethod[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PAYMENT_METHODS];
  const methods = raw
    .map((m): PaymentMethod | null => {
      if (!m || typeof m !== 'object') return null;
      const pm = m as Partial<PaymentMethod>;
      if (typeof pm.id !== 'string' || typeof pm.label !== 'string' || !pm.id) return null;
      return { id: pm.id, label: pm.label };
    })
    .filter((m): m is PaymentMethod => m !== null);
  return methods.length > 0 ? methods : [...DEFAULT_PAYMENT_METHODS];
}

function normalizePayments(raw: unknown, validMethodIds: Set<string>): Record<string, Payment> {
  const out: Record<string, Payment> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const rawP of Object.values(raw as Record<string, unknown>)) {
    if (!rawP || typeof rawP !== 'object') continue;
    const p = rawP as Partial<Payment>;
    if (typeof p.studentId !== 'string' || !p.studentId) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount)) continue;
    const id = typeof p.id === 'string' && p.id ? p.id : newId();
    const methodId = typeof p.methodId === 'string' && validMethodIds.has(p.methodId) ? p.methodId : MIGRATED_METHOD_ID;
    const kind = p.kind === 'pack' || p.kind === 'ajuste' ? p.kind : 'clase';
    out[id] = {
      id,
      studentId: p.studentId,
      date: typeof p.date === 'string' ? p.date : new Date().toISOString().slice(0, 10),
      amount,
      methodId,
      concept: typeof p.concept === 'string' ? p.concept : undefined,
      kind,
      classRef:
        p.classRef && typeof p.classRef === 'object' && typeof (p.classRef as { day?: unknown }).day === 'string'
          ? { day: (p.classRef as { day: string }).day, hour: Number((p.classRef as { hour: unknown }).hour) || 0 }
          : undefined,
      packId: typeof p.packId === 'string' ? p.packId : undefined,
    };
  }
  return out;
}

function normalizePacks(raw: unknown): Record<string, Pack> {
  const out: Record<string, Pack> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const rawP of Object.values(raw as Record<string, unknown>)) {
    if (!rawP || typeof rawP !== 'object') continue;
    const p = rawP as Partial<Pack>;
    if (typeof p.studentId !== 'string' || !p.studentId) continue;
    const total = Number(p.totalClasses);
    if (!Number.isFinite(total) || total <= 0) continue;
    const id = typeof p.id === 'string' && p.id ? p.id : newId();
    out[id] = {
      id,
      studentId: p.studentId,
      totalClasses: Math.round(total),
      price: Number(p.price) || 0,
      purchaseDate: typeof p.purchaseDate === 'string' ? p.purchaseDate : new Date().toISOString().slice(0, 10),
      methodId: typeof p.methodId === 'string' ? p.methodId : MIGRATED_METHOD_ID,
    };
  }
  return out;
}

function normalizeExpenses(raw: unknown): Record<string, Expense> {
  const out: Record<string, Expense> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const rawE of Object.values(raw as Record<string, unknown>)) {
    if (!rawE || typeof rawE !== 'object') continue;
    const e = rawE as Partial<Expense>;
    const amount = Number(e.amount);
    if (!Number.isFinite(amount)) continue;
    const id = typeof e.id === 'string' && e.id ? e.id : newId();
    out[id] = {
      id,
      date: typeof e.date === 'string' ? e.date : new Date().toISOString().slice(0, 10),
      concept: typeof e.concept === 'string' ? e.concept : '',
      amount,
    };
  }
  return out;
}

/**
 * Sube un intermedio v2 a v3: agrega medios/settings/libros; si el origen ya es v3
 * conserva sus pagos/packs/gastos; si es v2 (o más viejo) SINTETIZA un pago por cada
 * participante de las clases marcadas `paid`, para que los totales queden idénticos.
 * En ambos casos se elimina `paid` (el estado pasa a derivarse de los pagos).
 */
function migrateV2toV3(v2: V2Intermediate, rawSource: unknown): AgendaData {
  const src = (rawSource ?? {}) as Record<string, unknown>;
  const isV3Source = !!src.payments && typeof src.payments === 'object';

  const paymentMethods = normalizeMethods(src.paymentMethods);
  const methodIds = new Set(paymentMethods.map((m) => m.id));

  const rawSettings = (src.settings ?? {}) as Partial<Settings>;
  const settings: Settings = {
    defaultMethodId:
      typeof rawSettings.defaultMethodId === 'string' && methodIds.has(rawSettings.defaultMethodId)
        ? rawSettings.defaultMethodId
        : methodIds.has(DEFAULT_SETTINGS.defaultMethodId)
          ? DEFAULT_SETTINGS.defaultMethodId
          : paymentMethods[0].id,
    packLowThreshold: Number(rawSettings.packLowThreshold) || DEFAULT_SETTINGS.packLowThreshold,
  };

  const packs = normalizePacks(src.packs);
  const expenses = normalizeExpenses(src.expenses);
  const blocks = normalizeBlocks(src.blocks);

  // Clases sin `paid` (el estado se deriva). Se conservan duración/estado/serie (v4).
  const days: AgendaData['days'] = {};
  for (const [dKey, slots] of Object.entries(v2.days)) {
    const clean: AgendaData['days'][string] = {};
    for (const [hour, entry] of Object.entries(slots)) {
      clean[hour] = {
        type: entry.type,
        participants: entry.participants,
        price: entry.price,
        duration: entry.duration,
        state: entry.state,
        seriesId: entry.seriesId,
      };
    }
    days[dKey] = clean;
  }

  // Pagos: conservar los de v3, o sintetizar desde `paid` para v1/v2.
  let payments: Record<string, Payment>;
  if (isV3Source) {
    payments = normalizePayments(src.payments, methodIds);
  } else {
    payments = {};
    for (const [dKey, slots] of Object.entries(v2.days)) {
      for (const [hour, entry] of Object.entries(slots)) {
        if (!entry.paid) continue;
        const n = entry.participants.length || 1;
        for (const p of entry.participants) {
          if (!p.studentId) continue; // solo se puede cobrar a fichas; los sueltos no se rastrean
          const student = v2.students[p.studentId];
          const share = applyDiscountChain(entry.price / n, student?.discount, p.discount);
          const id = newId();
          payments[id] = {
            id,
            studentId: p.studentId,
            date: dayKeyToISO(dKey),
            amount: share,
            methodId: MIGRATED_METHOD_ID,
            concept: 'Cobro migrado',
            kind: 'clase',
            classRef: { day: dKey, hour: Number(hour) },
          };
        }
      }
    }
  }

  return {
    version: DATA_VERSION,
    prices: v2.prices,
    days,
    students: v2.students,
    payments,
    packs,
    expenses,
    paymentMethods,
    settings,
    blocks,
  };
}

/** Sanea los bloqueos de disponibilidad (v4) desde un JSON externo. */
function normalizeBlocks(raw: unknown): Record<string, DayBlock> {
  const out: Record<string, DayBlock> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [dKey, rawB] of Object.entries(raw as Record<string, unknown>)) {
    if (!rawB || typeof rawB !== 'object') continue;
    const b = rawB as Partial<DayBlock>;
    const hours = Array.isArray(b.hours)
      ? b.hours.filter((h): h is number => typeof h === 'number' && Number.isFinite(h))
      : [];
    const fullDay = Boolean(b.fullDay);
    if (!fullDay && hours.length === 0) continue;
    out[dKey] = {
      fullDay: fullDay || undefined,
      hours: fullDay ? undefined : hours,
      reason: typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim() : undefined,
    };
  }
  return out;
}

/**
 * Punto de entrada: normaliza cualquier JSON (v1/v2/v3/v4) a un AgendaData v4 completo.
 * Encadena las migraciones anteriores; migrateV2toV3 ya emite la versión actual
 * (DATA_VERSION = 4) con los campos nuevos conservados.
 */
export function normalizeToV4(raw: unknown): AgendaData {
  return migrateV2toV3(normalizeToV2(raw), raw);
}
