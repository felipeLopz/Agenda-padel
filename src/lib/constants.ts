import type { PaymentMethod, Prices, Settings } from '../types';

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

export const DEFAULT_PRICES: Prices = { grupal: 4000, indiv: 12000 };

/** Versión actual del formato de datos. Ver lib/migrate.ts para las migraciones v1→v2→v3→v4. */
export const DATA_VERSION = 4;

/** Duraciones de clase ofrecidas (minutos). La clase clásica es de 60. */
export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

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
};
