import type { ClassType, PaymentMethod, Prices, Settings } from '../types';

/** Etiqueta legible de cada tipo de clase (una sola fuente para toda la app). */
export const CLASS_TYPE_LABEL: Record<ClassType, string> = {
  grupal: 'Grupal',
  doble: 'Doble',
  indiv: 'Individual',
};

/** Franjas horarias de trabajo: 7 a 16, una clase por hora. */
export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** Índice 0 = domingo, igual que Date.getDay(). */
export const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEKDAY_NAMES_LONG = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export const STORAGE_KEY = 'agenda-padel:data';

export const DEFAULT_PRICES: Prices = { grupal: 4000, doble: 8000, indiv: 12000 };

/** Versión actual del formato de datos. Ver lib/migrate.ts para las migraciones v1→…→v16. */
export const DATA_VERSION = 16;

/**
 * Primera versión con "agenda de tiempo real": la clave del día es la hora de inicio en
 * MINUTOS (no la hora entera). Los datos con versión menor guardan la hora entera y la
 * migración los multiplica por 60. Ver lib/migrate.ts.
 */
export const TIME_REAL_VERSION = 10;

/** Días laborales por defecto: lunes a viernes (0=domingo … 6=sábado). */
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

/** Duraciones de clase ofrecidas (minutos). La clase clásica es de 60. */
export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

/** Temas de pádel sugeridos para el contenido de la clase (v5). */
export const COMMON_TOPICS = [
  'Saque',
  'Resto',
  'Bandeja',
  'Víbora',
  'Remate',
  'Volea',
  'Globo',
  'Pared de fondo',
  'Pared lateral',
  'Contrapared',
  'Salida de pared',
  'Dejada',
  'Chiquita',
  'Defensa',
  'Ataque',
  'Posicionamiento',
  'Físico',
];

/** Medios de pago por defecto (la lista es configurable desde Configuración). */
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'mercadopago', label: 'Mercado Pago' },
];

/** Medio "histórico" que usa la migración para los cobros de datos viejos. */
export const MIGRATED_METHOD_ID = 'efectivo';

export const DEFAULT_SETTINGS: Settings = {
  defaultMethodId: 'efectivo',
  packLowThreshold: 2,
  workDays: [...DEFAULT_WORKDAYS],
  startHour: 7,
  endHour: 16,
  theme: 'dark',
  soundOnCollect: false,
};
