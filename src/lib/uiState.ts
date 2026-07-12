// Estado de interfaz LOCAL del dispositivo (no se sincroniza a la nube): qué vista/pestaña
// estaba abierta y el período que se miraba, para restaurarlo al recargar (F5). Se guarda
// bajo su propia clave, aparte del bloque de datos que se sincroniza.

import type { ViewMode } from '../components/Header';

const UI_KEY = 'agenda-padel:ui';

export interface UiState {
  /** Vista/pestaña activa. */
  view: ViewMode;
  /** Año del selector (vista Anual). */
  year: number;
  /** Ancla de la semana en ms (vista Semanal), para volver a la misma semana. */
  weekAnchorMs: number;
}

const ALL_VIEWS: ViewMode[] = ['hoy', 'anual', 'semanal', 'alumnos', 'caja', 'stats'];

/** Lee el estado de UI guardado (validado). Devuelve {} si no hay o está corrupto. */
export function loadUiState(): Partial<UiState> {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<UiState>;
    const out: Partial<UiState> = {};
    if (typeof parsed.view === 'string' && ALL_VIEWS.includes(parsed.view as ViewMode)) {
      out.view = parsed.view as ViewMode;
    }
    if (typeof parsed.year === 'number' && Number.isFinite(parsed.year)) out.year = parsed.year;
    if (typeof parsed.weekAnchorMs === 'number' && Number.isFinite(parsed.weekAnchorMs)) {
      out.weekAnchorMs = parsed.weekAnchorMs;
    }
    return out;
  } catch {
    return {};
  }
}

/** Guarda el estado de UI (vista + período). Silencioso si no hay storage. */
export function saveUiState(state: UiState): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(state));
  } catch {
    // Sin localStorage (modo privado, cuota llena, etc.): no es crítico, se ignora.
  }
}
