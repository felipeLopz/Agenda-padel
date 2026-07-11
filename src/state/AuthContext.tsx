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
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
function traducirError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('already registered')) return 'Ese email ya tiene una cuenta. Probá iniciar sesión.';
  if (m.includes('password should be at least')) return 'La contraseña es demasiado corta (mínimo 6 caracteres).';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'El email no parece válido.';
  if (m.includes('email not confirmed'))
    return 'La cuenta todavía no está confirmada. Desactivá "Confirm email" en Supabase.';
  return message;
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
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error ? traducirError(error.message) : null };
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
