import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/** Estado de autenticación + acciones de login/registro/cerrar sesión (Tanda 6). */
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true mientras se resuelve la sesión guardada (evita parpadeos del login). */
  loading: boolean;
  /** Supabase configurado (hay .env). Si es false, se avisa en la pantalla de login. */
  configured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Traduce los errores de Supabase Auth a mensajes simples en español. Mapea los casos
 * más comunes y, para cualquier otro, devuelve un mensaje genérico claro (nunca inglés
 * crudo ni tecnicismos).
 */
function traducirError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('email not confirmed'))
    return 'Todavía no confirmaste tu cuenta. Revisá el correo que te enviamos.';
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'Email o contraseña incorrectos.';
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'Ese email ya tiene una cuenta. Probá iniciar sesión.';
  if (m.includes('password should') || m.includes('weak password') || m.includes('at least 6'))
    return 'La contraseña es demasiado corta (mínimo 6 caracteres).';
  if (m.includes('unable to validate email') || m.includes('invalid email') || m.includes('invalid format'))
    return 'El email no parece válido.';
  if (
    m.includes('for security purposes') ||
    m.includes('rate limit') ||
    m.includes('too many') ||
    m.includes('email rate') ||
    m.includes('over_email_send_rate')
  )
    return 'Probaste muchas veces seguidas. Esperá un momento y volvé a intentar.';
  if (m.includes('signups not allowed') || m.includes('signup is disabled'))
    return 'El registro no está disponible por ahora.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed'))
    return 'No pudimos conectar. Revisá tu conexión a internet e intentá de nuevo.';
  return 'Ocurrió un error. Intentá de nuevo.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    // Sesión guardada (lectura local: funciona sin internet).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // Se mantiene al día ante login / logout / refresco de token.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configured: isSupabaseConfigured,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? traducirError(error.message) : null };
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: traducirError(error.message) };
        // Con confirmación de email activada, si el email YA estaba registrado Supabase
        // devuelve un usuario con `identities` vacío (para no revelar qué emails existen).
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          return { error: 'Ese email ya tiene una cuenta. Probá iniciar sesión.' };
        }
        // Si no vino sesión, hay que confirmar el correo antes de poder entrar.
        return { error: null, needsConfirmation: !data.session };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
