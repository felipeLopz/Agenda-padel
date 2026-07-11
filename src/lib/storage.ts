import type { AgendaData } from '../types';
import {
  DATA_VERSION,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PRICES,
  DEFAULT_SETTINGS,
  STORAGE_KEY,
} from './constants';
import { normalizeToV4 } from './migrate';

function emptyData(): AgendaData {
  return {
    version: DATA_VERSION,
    prices: { ...DEFAULT_PRICES },
    days: {},
    students: {},
    payments: {},
    packs: {},
    expenses: {},
    paymentMethods: [...DEFAULT_PAYMENT_METHODS],
    settings: { ...DEFAULT_SETTINGS },
    blocks: {},
  };
}

/**
 * Valida y completa un objeto JSON arbitrario para convertirlo en AgendaData v4.
 * Admite el localStorage propio (v1..v4) y archivos exportados por el prototipo (v1).
 * Las migraciones v1→v2→v3→v4 viven en lib/migrate.ts. Cualquier campo faltante se
 * completa con un valor por defecto en lugar de descartar todo el archivo.
 */
export function normalizeData(raw: unknown): AgendaData {
  return normalizeToV4(raw);
}

export function loadData(): AgendaData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return normalizeData(JSON.parse(raw));
  } catch (err) {
    console.error('No se pudieron leer los datos guardados; se inicia vacío.', err);
    return emptyData();
  }
}

export function saveData(data: AgendaData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('No se pudieron guardar los datos en este dispositivo.', err);
  }
}

/** Descarga un archivo JSON de respaldo (formato v2: incluye alumnos). */
export function exportToFile(data: AgendaData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `agenda-padel-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Lee un archivo JSON elegido por el usuario y lo normaliza a v2 (migrando si es v1). */
export function importFromFile(file: File): Promise<AgendaData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(normalizeData(JSON.parse(String(reader.result))));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
