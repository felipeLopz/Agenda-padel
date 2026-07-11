// Tipos de datos del negocio.
//
// v3 (Tanda 2 — plata): se agrega el libro de pagos, packs (bonos prepagos),
// gastos, medios de pago configurables y descuentos. El estado cobrado/pendiente
// de cada clase YA NO se guarda: se DERIVA de los pagos registrados (ver
// lib/money.ts). El formato v2 (con `paid` por clase) se migra automáticamente
// (ver lib/migrate.ts), sin perder nada.

/** Grupal: varios alumnos, se cobra por alumno. Individual: un solo alumno, precio por clase. */
export type ClassType = 'grupal' | 'indiv';

/** Nivel / categoría del alumno. */
export type StudentLevel = 'principiante' | 'intermedio' | 'avanzado' | 'competicion';

/**
 * Descuento: porcentaje (0..100) o monto fijo en pesos.
 * Se usa en dos lugares distintos:
 *  - `Student.discount`: descuento FIJO de la ficha, permanente, aplica a todas sus clases.
 *  - `ClassParticipant.discount`: descuento PUNTUAL, una sola vez, en esa clase.
 * Cuando conviven, se encadenan: primero el fijo, después el puntual (ver lib/discount.ts).
 */
export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

/**
 * Adjunto (v5): foto comprimida (data URL) o enlace a un video. Los videos NO se
 * suben como archivo (pesan demasiado para localStorage): se guarda un enlace.
 */
export interface Attachment {
  id: string;
  kind: 'foto' | 'video';
  /** Foto: data URL comprimida (como la foto de perfil). */
  dataUrl?: string;
  /** Video: enlace (YouTube, Drive, etc.). */
  url?: string;
  caption?: string;
  createdAt: string;
}

/** Objetivo de un alumno con seguimiento (v5). */
export interface Objective {
  id: string;
  text: string;
  status: 'progreso' | 'cumplido';
  createdAt: string;
}

/** Nota de evolución del alumno a lo largo del tiempo (v5). */
export interface ProgressNote {
  id: string;
  /** Fecha "YYYY-MM-DD". */
  date: string;
  text: string;
}

/** Ficha de un alumno. Los alumnos no se borran: se archivan con `active: false`. */
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  /** Foto opcional como data URL (base64), comprimida al subir para no llenar localStorage. */
  photo?: string;
  /** Teléfono para el link de WhatsApp. */
  phone?: string;
  level: StudentLevel;
  /** Cumpleaños en formato "YYYY-MM-DD" (el que usa <input type="date">). */
  birthday?: string;
  /** Notas privadas del profesor (texto libre). */
  notes?: string;
  /** Etiquetas libres que crea el profesor (ej: "zurdo", "paga puntual"). */
  tags: string[];
  /** Activo / archivado. */
  active: boolean;
  /** Descuento fijo permanente de la ficha (opcional). */
  discount?: Discount;
  /** Objetivos del alumno con seguimiento (v5). */
  objectives?: Objective[];
  /** Notas de evolución del alumno, línea de tiempo (v5). */
  progressNotes?: ProgressNote[];
  /** Fotos y enlaces de video del alumno (v5). */
  attachments?: Attachment[];
  /** Alta de la ficha (ISO). */
  createdAt: string;
}

/**
 * Un participante de una clase.
 * - `studentId` apunta a la ficha cuando está vinculado; es `null` para un nombre
 *   suelto todavía sin ficha.
 * - `name` es el texto del suelto y además una caché/fallback.
 * - `discount` es un descuento PUNTUAL (una vez) para este alumno en esta clase.
 */
export interface ClassParticipant {
  studentId: string | null;
  name: string;
  discount?: Discount;
}

/** Estado de una clase en la agenda (distinto del estado de cobro, que se deriva). */
export type ClassState = 'confirmada' | 'tentativa' | 'cancelada' | 'ausente';

export interface ClassEntry {
  type: ClassType;
  /** Participantes de la clase. En "indiv" siempre tiene un único elemento. */
  participants: ClassParticipant[];
  /** Precio "de lista" de la clase completa (antes de descuentos). */
  price: number;
  /** Duración en minutos. Ausente = 60 (compatibilidad con datos v3). */
  duration?: number;
  /** Estado de agenda. Ausente = 'confirmada'. Las 'cancelada' no generan plata. */
  state?: ClassState;
  /** Id de la serie recurrente a la que pertenece (si fue generada por recurrencia). */
  seriesId?: string;
  /** Temas trabajados en la clase (v5): "saque", "bandeja", "víbora", ... */
  content?: string[];
  /** Fotos y enlaces de video de la clase (v5). */
  attachments?: Attachment[];
  // Nota: ya NO existe `paid`. El estado de cobro se deriva de los pagos.
}

/** Bloqueo de disponibilidad de un día: día completo y/o algunas horas. */
export interface DayBlock {
  /** Todo el día bloqueado. */
  fullDay?: boolean;
  /** Horas puntuales bloqueadas (7..16). */
  hours?: number[];
  /** Motivo opcional (vacaciones, feriado personal, etc.). */
  reason?: string;
}

/** Una franja horaria por día: la clave es la hora ("7".."16"). */
export type DaySlots = Record<string, ClassEntry>;

/**
 * Clave de día con formato "AÑO-MES-DIA", mes indexado desde 0 (enero = 0).
 * Se conserva este formato — y no un ISO estándar — por compatibilidad con
 * los archivos JSON exportados por el prototipo original.
 */
export type DayKey = string;

export interface Prices {
  /** Precio grupal, por alumno. */
  grupal: number;
  /** Precio individual, por clase. */
  indiv: number;
}

/** Medio de pago configurable (efectivo, transferencia, Mercado Pago, ...). */
export interface PaymentMethod {
  id: string;
  label: string;
}

/**
 * Un pago registrado. Representa plata que efectivamente entró (con su medio),
 * salvo que provenga de la migración de datos viejos (misma estructura).
 */
export interface Payment {
  id: string;
  studentId: string;
  /** Fecha del cobro en formato "YYYY-MM-DD". */
  date: string;
  amount: number;
  methodId: string;
  /** Concepto libre para el recibo. */
  concept?: string;
  /** Origen del pago: cobro de clase(s), compra de pack, o ajuste manual. */
  kind: 'clase' | 'pack' | 'ajuste';
  /** Si vino del cobro rápido de una clase puntual (para poder deshacerlo). */
  classRef?: { day: DayKey; hour: number };
  /** Si es la compra de un pack. */
  packId?: string;
}

/**
 * Bono / pack prepago: el alumno paga por adelantado N clases. Comprarlo genera
 * un `Payment` (kind 'pack'). Las clases que toma se descuentan del pack de forma
 * automática (FIFO por fecha); las "restantes" se derivan, no se guardan.
 */
export interface Pack {
  id: string;
  studentId: string;
  totalClasses: number;
  price: number;
  /** Fecha de compra "YYYY-MM-DD"; el pack cubre clases con fecha >= esta. */
  purchaseDate: string;
  methodId: string;
}

/** Gasto del profesor (alquiler de cancha, pelotas, etc.). */
export interface Expense {
  id: string;
  /** Fecha "YYYY-MM-DD". */
  date: string;
  concept: string;
  amount: number;
}

export interface Settings {
  /** Medio de pago usado por defecto en el cobro rápido. */
  defaultMethodId: string;
  /** Umbral de "pack por agotarse": avisar cuando queden <= estas clases. */
  packLowThreshold: number;
  /** Días laborales (0=domingo … 6=sábado). Default L-V. Ausente = default. (v6) */
  workDays?: number[];
  /** Hora de inicio de la jornada (default 7). (v6) */
  startHour?: number;
  /** Hora de fin, inclusive (default 16). (v6) */
  endHour?: number;
  /** Tema visual: 'dark' (default) | 'light'. (v6) */
  theme?: 'dark' | 'light';
  /** Fecha ISO de la última exportación de respaldo (para el recordatorio). (v6) */
  lastExportAt?: string;
}

export interface AgendaData {
  /** Versión del formato de datos (3 = con plata). Permite migraciones futuras. */
  version: number;
  prices: Prices;
  days: Record<DayKey, DaySlots>;
  /** Base de alumnos, indexada por id. */
  students: Record<string, Student>;
  /** Libro de pagos, indexado por id. */
  payments: Record<string, Payment>;
  /** Packs / bonos, indexados por id. */
  packs: Record<string, Pack>;
  /** Gastos, indexados por id. */
  expenses: Record<string, Expense>;
  /** Medios de pago configurables. */
  paymentMethods: PaymentMethod[];
  settings: Settings;
  /** Bloqueos de disponibilidad por día (v4). */
  blocks: Record<DayKey, DayBlock>;
}

/** Franja (día + hora) que se está creando o editando en el formulario de clase. */
export interface ClassFormTarget {
  day: DayKey;
  hour: number;
  /** null cuando es una clase nueva; la clase existente cuando se edita. */
  entry: ClassEntry | null;
}
