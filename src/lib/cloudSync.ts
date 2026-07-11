// Sincronización en la nube (Tanda 6).
//
// Modelo de datos: UNA sola fila por usuario en la tabla `agenda` de Supabase, con
// TODO el AgendaData guardado como un bloque JSON (columna jsonb). Las reglas RLS
// garantizan que cada usuario solo ve/edita su propia fila (user_id = auth.uid()).
//
// Estrategia:
//  - Al iniciar sesión se decide qué gana (ver decideInitialSync).
//  - Cada cambio local se sube con un pequeño retardo (debounce, en AgendaContext).
//  - Conflictos: "gana el último cambio" a nivel de TODO el bloque. Si se edita en
//    dos dispositivos a la vez, el último en guardar pisa al otro entero.
//  - localStorage sigue siendo la caché: sin internet la app anda igual y sincroniza
//    al reconectar o en el próximo cambio.

import { supabase } from './supabase';
import { normalizeData } from './storage';
import type { AgendaData } from '../types';

// Claves auxiliares en localStorage (NO tocan el bloque de datos v6).
const UPDATED_AT_KEY = 'agenda-padel:updatedAt';
const OWNER_KEY = 'agenda-padel:ownerId';

/** Foto de la fila remota. */
export interface RemoteSnapshot {
  data: AgendaData;
  updatedAt: string; // ISO
}

/** Sello de la última modificación local (para comparar con la nube). */
export function getLocalUpdatedAt(): string | null {
  return localStorage.getItem(UPDATED_AT_KEY);
}
export function setLocalUpdatedAt(iso: string): void {
  localStorage.setItem(UPDATED_AT_KEY, iso);
}

/** Id del usuario dueño de la caché local (evita mezclar datos entre cuentas). */
export function getLocalOwnerId(): string | null {
  return localStorage.getItem(OWNER_KEY);
}
export function setLocalOwnerId(userId: string): void {
  localStorage.setItem(OWNER_KEY, userId);
}

/** ¿El bloque local tiene datos cargados (no es una agenda vacía recién creada)? */
export function hasMeaningfulData(d: AgendaData): boolean {
  return (
    Object.keys(d.days).length > 0 ||
    Object.keys(d.students).length > 0 ||
    Object.keys(d.payments).length > 0 ||
    Object.keys(d.packs).length > 0 ||
    Object.keys(d.expenses).length > 0
  );
}

/** Baja la fila del usuario. Devuelve null si todavía no tiene datos en la nube. */
export async function pullRemote(userId: string): Promise<RemoteSnapshot | null> {
  const { data, error } = await supabase
    .from('agenda')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error; // p. ej. sin conexión: lo maneja quien llama
  if (!data) return null;
  // Se normaliza a v6 por las dudas (por si viniera un bloque de formato viejo).
  return { data: normalizeData(data.data), updatedAt: data.updated_at as string };
}

/**
 * Sube (o crea) la fila del usuario con todo el bloque. Devuelve true si salió bien.
 * No lanza: ante error (sin internet, etc.) devuelve false para reintentar luego.
 */
export async function pushRemote(userId: string, data: AgendaData, updatedAt: string): Promise<boolean> {
  const { error } = await supabase
    .from('agenda')
    .upsert({ user_id: userId, data, updated_at: updatedAt }, { onConflict: 'user_id' });
  if (error) {
    console.error('No se pudo sincronizar con la nube (se reintentará).', error);
    return false;
  }
  setLocalUpdatedAt(updatedAt);
  return true;
}

/** Decisión de la sincronización inicial (al iniciar sesión). */
export type SyncDecision =
  | { action: 'push'; updatedAt: string } // gana lo local (o migración inicial): se sube
  | { action: 'adopt'; data: AgendaData; updatedAt: string } // gana la nube: se baja
  | { action: 'noop' } // nada que hacer (todo vacío)
  | { action: 'offline' }; // no se pudo contactar la nube

/**
 * Decide qué hacer al iniciar sesión, sin pisar datos a ciegas:
 *  - Nube vacía + datos locales míos  → subir (migración).
 *  - Nube con datos + local vacío     → bajar.
 *  - Ambos con datos                  → gana el más reciente (por updated_at).
 *    Si no se puede determinar (datos previos a la Tanda 6, sin sello), se PREGUNTA.
 */
export async function decideInitialSync(userId: string, localData: AgendaData): Promise<SyncDecision> {
  let remote: RemoteSnapshot | null;
  try {
    remote = await pullRemote(userId);
  } catch {
    return { action: 'offline' };
  }

  // Si la caché local pertenece a OTRA cuenta, no se trata como propia.
  const ownerId = getLocalOwnerId();
  const localIsMine = ownerId === null || ownerId === userId;
  const localHasData = localIsMine && hasMeaningfulData(localData);

  if (!remote) {
    // Nube vacía: si hay datos locales míos, se suben (migración). Si no, nada.
    if (localHasData) {
      return { action: 'push', updatedAt: getLocalUpdatedAt() ?? new Date().toISOString() };
    }
    return { action: 'noop' };
  }

  // Nube con datos y local vacío (o de otra cuenta): se baja la nube.
  if (!localHasData) {
    return { action: 'adopt', data: remote.data, updatedAt: remote.updatedAt };
  }

  // Ambos con datos: gana el más reciente por fecha de última modificación.
  const localUpdatedAt = getLocalUpdatedAt();
  if (!localUpdatedAt) {
    // Sin sello local (datos previos a la Tanda 6): no se puede determinar.
    // Se pregunta antes de pisar nada.
    const keepRemote = window.confirm(
      'Se encontraron datos en ESTE DISPOSITIVO y también en la NUBE, y no se puede ' +
        'determinar cuál es más reciente.\n\n' +
        'Aceptar = conservar los datos de la NUBE (se descartan los de este dispositivo).\n' +
        'Cancelar = conservar los datos de ESTE DISPOSITIVO (se suben y pisan los de la nube).'
    );
    return keepRemote
      ? { action: 'adopt', data: remote.data, updatedAt: remote.updatedAt }
      : { action: 'push', updatedAt: new Date().toISOString() };
  }

  const remoteNewer = new Date(remote.updatedAt).getTime() > new Date(localUpdatedAt).getTime();
  return remoteNewer
    ? { action: 'adopt', data: remote.data, updatedAt: remote.updatedAt }
    : { action: 'push', updatedAt: localUpdatedAt };
}
