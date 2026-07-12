// Migración de datos y normalización general (v1 → v2 → v3 → … → v10).
//
// v1 (prototipo): clases con `names: string[]`, sin alumnos.
// v2 (Tanda 1): base `students` + clases con `participants` y `paid` por clase.
// v3 (Tanda 2): + pagos, packs, gastos, medios de pago y descuentos; el estado
//   cobrado/pendiente de la clase se DERIVA de los pagos, así que `paid` se elimina.
// v10 (Agenda de tiempo real): la clave de cada clase dentro del día pasa de la HORA
//   ENTERA (7..16) a los MINUTOS de inicio desde la medianoche (7 → 420, 9:30 → 570).
//   Los pagos referencian la clase por `{ day, start }` (antes `{ day, hour }`).
//
// `normalizeData` (en storage.ts) corre al cargar el localStorage y al importar
// cualquier JSON. La cadena es: normalizeToV2 (maneja v1/v2/v3) → migrateV2toV3.
//
// IMPORTANTE: casi todo es idempotente (los campos faltantes se completan por defecto),
// PERO la conversión de horas→minutos NO lo es (multiplicar por 60 dos veces rompería
// los horarios). Por eso se GATEA por la versión del origen: solo se multiplica cuando
// `version < TIME_REAL_VERSION` (ver `usesLegacyHourKeys`). Los datos ya en v10 traen la
// clave en minutos y se dejan intactos. No se descarta nada.

import type {
  Attachment,
  ClassParticipant,
  ClassState,
  ClassType,
  DayBlock,
  Discount,
  Expense,
  Objective,
  Pack,
  PadelCategory,
  PadelRank,
  Payment,
  PaymentMethod,
  Prices,
  ProgressNote,
  Reminder,
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
  TIME_REAL_VERSION,
} from './constants';
import { newId } from './id';
import { applyDiscountChain } from './discount';
import { displayName, makeStudentFromName, normalizeName } from './students';

const VALID_LEVELS: StudentLevel[] = ['principiante', 'intermedio', 'avanzado', 'competicion'];
const VALID_CATEGORIES: PadelCategory[] = ['1ra', '2da', '3ra', '4ta', '5ta', '6ta', '7ma', '8va'];
const VALID_RANKS: PadelRank[] = ['baja', 'media', 'alta'];

/** Migración v6→v7: mapea el nivel viejo al nuevo campo "nivel" (baja/media/alta). */
const LEVEL_TO_RANK: Record<StudentLevel, PadelRank> = {
  principiante: 'baja',
  intermedio: 'media',
  avanzado: 'alta',
  competicion: 'alta',
};

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
  content?: string[];
  attachments?: Attachment[];
  reminder?: Reminder;
}
interface V2Intermediate {
  prices: Prices;
  students: Record<string, Student>;
  days: Record<string, Record<string, V2Entry>>;
}

/**
 * ¿El origen usa la clave vieja (hora entera 7..16) en vez de minutos? True para todo
 * dato con versión anterior a la "agenda de tiempo real" (o sin versión: prototipos y
 * datos v1..v9). En ese caso la clave de cada clase se multiplica por 60 (hora → minutos)
 * una sola vez. Los datos ya en v10 traen la clave en minutos y se dejan como están.
 */
function usesLegacyHourKeys(raw: unknown): boolean {
  const version = Number((raw as { version?: unknown } | null | undefined)?.version);
  return !(Number.isFinite(version) && version >= TIME_REAL_VERSION);
}

/**
 * Referencia a la clase de un pago (`classRef`). Acepta el formato nuevo `{ day, start }`
 * (minutos) y el viejo `{ day, hour }` (hora entera, que se multiplica por 60). Se prefiere
 * `start` si viene; si no, se convierte `hour`. Devuelve undefined si no hay día válido.
 */
function parseClassRef(raw: unknown): { day: string; start: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { day?: unknown; hour?: unknown; start?: unknown };
  if (typeof r.day !== 'string' || !r.day) return undefined;
  const start = Number(r.start);
  if (Number.isFinite(start)) return { day: r.day, start }; // formato nuevo (minutos)
  const hour = Number(r.hour);
  return { day: r.day, start: (Number.isFinite(hour) ? hour : 0) * 60 }; // formato viejo (hora → minutos)
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

/** Lista de strings no vacíos (temas de clase). undefined si queda vacía. */
function parseStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim());
  return list.length > 0 ? list : undefined;
}

/** Sanea adjuntos (fotos como data URL o enlaces de video). */
function parseAttachments(raw: unknown): Attachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((a): Attachment | null => {
      if (!a || typeof a !== 'object') return null;
      const at = a as Partial<Attachment>;
      const kind = at.kind === 'video' ? 'video' : 'foto';
      const dataUrl = typeof at.dataUrl === 'string' ? at.dataUrl : undefined;
      const url = typeof at.url === 'string' ? at.url : undefined;
      if (!dataUrl && !url) return null; // adjunto vacío
      return {
        id: typeof at.id === 'string' && at.id ? at.id : newId(),
        kind,
        dataUrl,
        url,
        caption: typeof at.caption === 'string' ? at.caption : undefined,
        createdAt: typeof at.createdAt === 'string' ? at.createdAt : new Date().toISOString(),
      };
    })
    .filter((a): a is Attachment => a !== null);
  return list.length > 0 ? list : undefined;
}

/** Sanea objetivos del alumno. */
function parseObjectives(raw: unknown): Objective[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((o): Objective | null => {
      if (!o || typeof o !== 'object') return null;
      const ob = o as Partial<Objective>;
      const text = typeof ob.text === 'string' ? ob.text.trim() : '';
      if (!text) return null;
      return {
        id: typeof ob.id === 'string' && ob.id ? ob.id : newId(),
        text,
        status: ob.status === 'cumplido' ? 'cumplido' : 'progreso',
        createdAt: typeof ob.createdAt === 'string' ? ob.createdAt : new Date().toISOString(),
      };
    })
    .filter((o): o is Objective => o !== null);
  return list.length > 0 ? list : undefined;
}

/** Sanea notas de evolución del alumno. */
function parseProgressNotes(raw: unknown): ProgressNote[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((n): ProgressNote | null => {
      if (!n || typeof n !== 'object') return null;
      const pn = n as Partial<ProgressNote>;
      const text = typeof pn.text === 'string' ? pn.text.trim() : '';
      if (!text) return null;
      return {
        id: typeof pn.id === 'string' && pn.id ? pn.id : newId(),
        date: typeof pn.date === 'string' ? pn.date : new Date().toISOString().slice(0, 10),
        text,
      };
    })
    .filter((n): n is ProgressNote => n !== null);
  return list.length > 0 ? list : undefined;
}

/** Sanea un recordatorio de un turno (v9). undefined si no tiene nota o fecha. */
function parseReminder(raw: unknown): Reminder | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<Reminder>;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  const remindAt = typeof r.remindAt === 'string' ? r.remindAt.trim() : '';
  if (!text || !remindAt) return undefined;
  return { text, remindAt, done: r.done === true };
}

/** Sanea una ficha que viene de un JSON externo. Devuelve null si es inservible. */
function normalizeStudent(raw: unknown): Student | null {
  if (!raw || typeof raw !== 'object') return null;
  // Se admite el campo viejo `level` (v6) para poder migrarlo a `rank`.
  const s = raw as Partial<Student> & { level?: unknown };
  const firstName = typeof s.firstName === 'string' ? s.firstName : '';
  const lastName = typeof s.lastName === 'string' ? s.lastName : '';
  if (!firstName && !lastName) return null;
  return {
    id: typeof s.id === 'string' && s.id ? s.id : newId(),
    firstName,
    lastName,
    photo: typeof s.photo === 'string' ? s.photo : undefined,
    phone: typeof s.phone === 'string' ? s.phone : undefined,
    // Categoría/nivel (v7). Si la ficha viene del formato viejo, se migra `level` → `rank`.
    category: VALID_CATEGORIES.includes(s.category as PadelCategory) ? (s.category as PadelCategory) : undefined,
    rank: VALID_RANKS.includes(s.rank as PadelRank)
      ? (s.rank as PadelRank)
      : VALID_LEVELS.includes(s.level as StudentLevel)
        ? LEVEL_TO_RANK[s.level as StudentLevel]
        : undefined,
    birthday: typeof s.birthday === 'string' ? s.birthday : undefined,
    notes: typeof s.notes === 'string' ? s.notes : undefined,
    tags: Array.isArray(s.tags) ? s.tags.filter((t): t is string => typeof t === 'string') : [],
    active: s.active !== false, // por defecto activo
    discount: parseDiscount(s.discount),
    objectives: parseObjectives(s.objectives),
    progressNotes: parseProgressNotes(s.progressNotes),
    attachments: parseAttachments(s.attachments),
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
  //    La clave de cada clase se normaliza a MINUTOS de inicio: los datos viejos traen la
  //    hora entera (7..16) y se multiplican por 60; los datos v10 ya vienen en minutos.
  const legacyKeys = usesLegacyHourKeys(raw);
  const days: V2Intermediate['days'] = {};
  if (src.days && typeof src.days === 'object') {
    for (const [dKey, rawSlots] of Object.entries(src.days)) {
      if (!rawSlots || typeof rawSlots !== 'object') continue;
      const cleanSlots: Record<string, V2Entry> = {};

      for (const [slotKeyRaw, rawEntry] of Object.entries(rawSlots as Record<string, unknown>)) {
        if (!rawEntry || typeof rawEntry !== 'object') continue;
        const rawKeyNum = Number(slotKeyRaw);
        if (!Number.isFinite(rawKeyNum)) continue; // clave inservible: se omite esa clase
        // Hora entera → minutos (×60) para datos viejos; en v10 la clave ya está en minutos.
        const slotKey = String(legacyKeys ? rawKeyNum * 60 : rawKeyNum);
        const entry = rawEntry as {
          type?: unknown;
          participants?: unknown;
          names?: unknown;
          price?: unknown;
          paid?: unknown;
          duration?: unknown;
          state?: unknown;
          seriesId?: unknown;
          content?: unknown;
          attachments?: unknown;
          reminder?: unknown;
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
              return {
                studentId,
                name,
                discount: parseDiscount(part.discount),
                price: typeof part.price === 'number' && part.price >= 0 ? part.price : undefined,
              };
            })
            .filter((p): p is ClassParticipant => p !== null);
        } else if (Array.isArray(entry.names)) {
          participants = entry.names
            .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
            .map((name) => ({ studentId: ensureStudentId(name), name: name.trim() }));
        }

        if (participants.length === 0) continue;
        const finalParticipants = type === 'indiv' ? participants.slice(0, 1) : participants;
        const priceNum = Number(entry.price) || 0;
        // v8: en grupal cada alumno lleva su precio propio. Si viene del formato viejo
        // (precio total repartido), se le asigna su prorrateo actual (precio ÷ cantidad),
        // así los totales y la parte de cada alumno quedan idénticos tras migrar.
        const pricedParticipants =
          type === 'grupal'
            ? finalParticipants.map((p) => ({
                ...p,
                price: typeof p.price === 'number' ? p.price : priceNum / (finalParticipants.length || 1),
              }))
            : finalParticipants;

        const durationNum = Number(entry.duration);
        const validStates: ClassState[] = ['confirmada', 'tentativa', 'cancelada', 'ausente'];
        cleanSlots[slotKey] = {
          type,
          participants: pricedParticipants,
          price: priceNum,
          paid: Boolean(entry.paid),
          duration: Number.isFinite(durationNum) && durationNum > 0 ? durationNum : undefined,
          state: validStates.includes(entry.state as ClassState) ? (entry.state as ClassState) : undefined,
          seriesId: typeof entry.seriesId === 'string' ? entry.seriesId : undefined,
          content: parseStringList(entry.content),
          attachments: parseAttachments(entry.attachments),
          reminder: parseReminder(entry.reminder),
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
      // Referencia a la clase: se convierte hora→minutos si venía en el formato viejo.
      classRef: parseClassRef(p.classRef),
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
  const validWorkDays = Array.isArray(rawSettings.workDays)
    ? rawSettings.workDays.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    : undefined;
  const settings: Settings = {
    defaultMethodId:
      typeof rawSettings.defaultMethodId === 'string' && methodIds.has(rawSettings.defaultMethodId)
        ? rawSettings.defaultMethodId
        : methodIds.has(DEFAULT_SETTINGS.defaultMethodId)
          ? DEFAULT_SETTINGS.defaultMethodId
          : paymentMethods[0].id,
    packLowThreshold: Number(rawSettings.packLowThreshold) || DEFAULT_SETTINGS.packLowThreshold,
    // Horario/días laborales/tema (v6): se completan con defaults si no vienen.
    workDays: validWorkDays && validWorkDays.length ? validWorkDays : [...(DEFAULT_SETTINGS.workDays ?? [])],
    startHour: typeof rawSettings.startHour === 'number' ? rawSettings.startHour : DEFAULT_SETTINGS.startHour,
    endHour: typeof rawSettings.endHour === 'number' ? rawSettings.endHour : DEFAULT_SETTINGS.endHour,
    theme: rawSettings.theme === 'light' ? 'light' : 'dark',
    lastExportAt: typeof rawSettings.lastExportAt === 'string' ? rawSettings.lastExportAt : undefined,
    soundOnCollect: rawSettings.soundOnCollect === true,
  };

  const packs = normalizePacks(src.packs);
  const expenses = normalizeExpenses(src.expenses);
  const blocks = normalizeBlocks(src.blocks);

  // Clases sin `paid` (el estado se deriva). Se conservan duración/estado/serie (v4)
  // y contenido/adjuntos (v5).
  const days: AgendaData['days'] = {};
  for (const [dKey, slots] of Object.entries(v2.days)) {
    const clean: AgendaData['days'][string] = {};
    // La clave (startStr) ya está en minutos: se copia tal cual.
    for (const [startStr, entry] of Object.entries(slots)) {
      clean[startStr] = {
        type: entry.type,
        participants: entry.participants,
        price: entry.price,
        duration: entry.duration,
        state: entry.state,
        seriesId: entry.seriesId,
        content: entry.content,
        attachments: entry.attachments,
        reminder: entry.reminder,
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
      // La clave del slot ya está en minutos (normalizeToV2 convirtió las horas viejas).
      for (const [startStr, entry] of Object.entries(slots)) {
        if (!entry.paid) continue;
        const n = entry.participants.length || 1;
        for (const p of entry.participants) {
          if (!p.studentId) continue; // solo se puede cobrar a fichas; los sueltos no se rastrean
          const student = v2.students[p.studentId];
          const share = applyDiscountChain(p.price ?? entry.price / n, student?.discount, p.discount);
          const id = newId();
          payments[id] = {
            id,
            studentId: p.studentId,
            date: dayKeyToISO(dKey),
            amount: share,
            methodId: MIGRATED_METHOD_ID,
            concept: 'Cobro migrado',
            kind: 'clase',
            classRef: { day: dKey, start: Number(startStr) },
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
 * Punto de entrada: normaliza cualquier JSON (v1..v10) a un AgendaData v10 completo.
 * Encadena las migraciones anteriores; migrateV2toV3 ya emite la versión actual
 * (DATA_VERSION = 10) con todos los campos nuevos conservados (contenido/adjuntos,
 * objetivos/notas, horario/días laborales/tema, categoría/nivel, precio por alumno,
 * recordatorio por turno) y con la clave de cada clase en minutos (agenda de tiempo
 * real). La conversión hora→minutos se aplica una sola vez, gateada por la versión del
 * origen (ver usesLegacyHourKeys). No descarta nada.
 */
export function normalizeToV10(raw: unknown): AgendaData {
  return migrateV2toV3(normalizeToV2(raw), raw);
}
