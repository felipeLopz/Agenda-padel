// Tipos de datos del negocio.
//
// v3 (Tanda 2 — plata): se agrega el libro de pagos, packs (bonos prepagos),
// gastos, medios de pago configurables y descuentos. El estado cobrado/pendiente
// de cada clase YA NO se guarda: se DERIVA de los pagos registrados (ver
// lib/money.ts). El formato v2 (con `paid` por clase) se migra automáticamente
// (ver lib/migrate.ts), sin perder nada.
//
// v10 (Agenda de tiempo real): la agenda deja de ser "una clase por hora entera".
// Ahora la CLAVE de cada clase dentro del día es su HORA DE INICIO EN MINUTOS desde
// la medianoche (9:00 = "540", 9:30 = "570") y, con su `duration`, ocupa su rango
// real [inicio, inicio+duración). Los pagos referencian la clase por `{ day, start }`
// (antes `{ day, hour }`). La migración v9→v10 convierte las horas enteras a minutos
// (hora × 60) sin perder nada (ver lib/migrate.ts).

/**
 * Tipo de clase (v14):
 *  - 'indiv'  → Individual: un solo alumno, precio por clase.
 *  - 'doble'  → Doble: exactamente 2 alumnos, se cobra por alumno (como grupal, con su
 *    propio precio por defecto).
 *  - 'grupal' → varios alumnos, se cobra por alumno.
 * En cuanto a la plata, 'doble' funciona igual que 'grupal' (precio propio por alumno).
 */
export type ClassType = 'grupal' | 'doble' | 'indiv';

/** Nivel viejo del alumno (v6 y anteriores). Se conserva SOLO para migrar a v7. */
export type StudentLevel = 'principiante' | 'intermedio' | 'avanzado' | 'competicion';

/** Categoría de pádel del alumno (1ra = la más alta … 8va). Campo manual (v7). */
export type PadelCategory = '1ra' | '2da' | '3ra' | '4ta' | '5ta' | '6ta' | '7ma' | '8va';

/** Nivel dentro de la categoría, elegido a mano por el profe (v7). */
export type PadelRank = 'baja' | 'media' | 'alta';

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
  /** Categoría de pádel (1ra..8va). Opcional: el profe la carga a mano. (v7) */
  category?: PadelCategory;
  /** Nivel dentro de la categoría (baja/media/alta). Opcional, manual. (v7) */
  rank?: PadelRank;
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
  /**
   * Precio PROPIO del alumno en una clase grupal (v8): cada uno paga su importe, no se
   * prorratea. En individual no se usa (el precio va en `ClassEntry.price`). Ausente en
   * datos viejos: la migración le asigna su prorrateo (precio ÷ cantidad).
   */
  price?: number;
  /**
   * Asistencia del alumno a esta clase (v11): `true` = vino, `false` = no vino,
   * `undefined` = sin marcar. Es SOLO un registro: NO afecta la plata ni la deuda (la
   * ausencia se cobra igual). Distinto del estado 'cancelada' de la clase, que sí saca plata.
   */
  attended?: boolean;
}

/** Estado de una clase en la agenda (distinto del estado de cobro, que se deriva). */
export type ClassState = 'confirmada' | 'tentativa' | 'cancelada' | 'ausente';

/**
 * Recordatorio que el profe le pone a un turno (v9). Se avisa DENTRO de la app.
 * Va atado a la clase: se mueve con ella y se borra con ella.
 */
export interface Reminder {
  /** Nota libre (ej: "cobrarle a Juan lo que debe", "llevar pelotas nuevas"). */
  text: string;
  /** Fecha/hora del aviso, en formato local "YYYY-MM-DDTHH:mm". */
  remindAt: string;
  /** Marcado como visto/hecho: deja de aparecer como pendiente. */
  done?: boolean;
}

export interface ClassEntry {
  type: ClassType;
  /** Participantes de la clase. En "indiv" siempre tiene un único elemento. */
  participants: ClassParticipant[];
  /** Precio "de lista" de la clase completa (antes de descuentos). */
  price: number;
  /**
   * Duración en minutos. Ausente = 60 (compatibilidad con datos v3). Junto con la clave
   * del día (hora de inicio en minutos) define el rango real que ocupa la clase (v10).
   */
  duration?: number;
  /** Estado de agenda. Ausente = 'confirmada'. Las 'cancelada' no generan plata. */
  state?: ClassState;
  /** Id de la serie recurrente a la que pertenece (si fue generada por recurrencia). */
  seriesId?: string;
  /** Temas trabajados en la clase (v5): "saque", "bandeja", "víbora", ... */
  content?: string[];
  /** Fotos y enlaces de video de la clase (v5). */
  attachments?: Attachment[];
  /** Recordatorio del profe para este turno (v9). */
  reminder?: Reminder;
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

/**
 * Clases de un día. La CLAVE es la hora de inicio EN MINUTOS desde la medianoche
 * (v10): 9:00 = "540", 9:30 = "570". Antes (v9) la clave era la hora entera ("7".."16")
 * y la duración era solo visual; ahora cada clase ocupa su rango real
 * [inicio, inicio+duración) y no se permiten solapamientos al cargar/mover.
 */
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
  /** Precio doble (clase de 2 alumnos), por alumno (v14). */
  doble: number;
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
  /**
   * Si vino del cobro rápido de una clase puntual (para poder deshacerlo). Referencia
   * la clase por su día y su hora de inicio en minutos (v10; antes era la hora entera).
   */
  classRef?: { day: DayKey; start: number };
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
  /** Sonido breve al cobrar una clase. Apagado por defecto. (Tanda 3 de efectos) */
  soundOnCollect?: boolean;
}

/**
 * Plantilla de turno (v12): un turno guardado con un nombre para reusar (ej "Grupo martes").
 * Guarda el tipo, los alumnos (con sus precios/descuentos) y la duración/contenido, PERO no
 * un día ni una hora: se aplica al crear un turno nuevo. NO participa de la plata: es solo
 * para prellenar el formulario más rápido.
 */
export interface ClassTemplate {
  id: string;
  name: string;
  type: ClassType;
  participants: ClassParticipant[];
  /** Precio de lista (para individual). En grupal el total sale de los precios por alumno. */
  price: number;
  duration?: number;
  content?: string[];
}

export interface AgendaData {
  /** Versión del formato de datos (12 = plantillas de turno). Permite migraciones futuras. */
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
  /** Plantillas de turno reusables (v12). No afectan la plata: solo prellenan el formulario. */
  templates: Record<string, ClassTemplate>;
}

/** Franja (día + hora de inicio en minutos) que se crea o edita en el formulario de clase. */
export interface ClassFormTarget {
  day: DayKey;
  /** Hora de inicio en minutos desde la medianoche (v10). */
  start: number;
  /** null cuando es una clase nueva; la clase existente cuando se edita. */
  entry: ClassEntry | null;
}
