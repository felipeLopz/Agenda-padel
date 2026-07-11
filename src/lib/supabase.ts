// Cliente de Supabase (Tanda 6 — sincronización en la nube).
//
// La URL y la clave pública ("publishable" / anon) se leen SOLO desde variables de
// entorno con prefijo VITE_ (archivo .env, que está en .gitignore). La clave es
// pública por diseño: viaja al cliente y queda protegida por las reglas Row Level
// Security (RLS). La clave NUNCA se escribe en el código.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

/** true si el .env tiene URL y clave. Sin esto, la app no intenta sincronizar. */
export const isSupabaseConfigured = Boolean(url && key);

// Si faltara la configuración, se usan valores de relleno para no romper el arranque;
// igual `isSupabaseConfigured` evita cualquier llamada real a la nube.
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key', {
  auth: {
    persistSession: true, // recuerda la sesión en localStorage (permite arrancar offline)
    autoRefreshToken: true,
  },
});
