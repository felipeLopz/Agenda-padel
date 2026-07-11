import { useState, type FormEvent } from 'react';
import { useAuth } from '../state/AuthContext';

/**
 * Pantalla de login / registro (Tanda 6). Usa la paleta "Estadio Nocturno" con
 * variables CSS, así combina con la app y respeta el tema claro/oscuro.
 */
export default function AuthScreen() {
  const { signIn, signUp, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Completá email y contraseña.');
      return;
    }
    setBusy(true);
    const action = mode === 'login' ? signIn : signUp;
    const { error: err } = await action(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === 'signup') {
      // Con "Confirm email" desactivado, el ingreso es automático. Si estuviera
      // activado, avisamos para que el usuario sepa qué pasa.
      setInfo('Cuenta creada. Si no entrás en unos segundos, revisá la confirmación de email en Supabase.');
    }
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setInfo(null);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__logo">🎾</span>
          <h1>Agenda de Pádel</h1>
          <p className="auth-card__sub">
            {mode === 'login'
              ? 'Ingresá para ver tu agenda en todos tus dispositivos.'
              : 'Creá tu cuenta para sincronizar en la nube.'}
          </p>
        </div>

        {!configured && (
          <p className="auth-card__error">
            Falta configurar Supabase: completá el archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_KEY.
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__row">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
          </div>
          <div className="auth-form__row">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && <p className="auth-card__error">{error}</p>}
          {info && <p className="auth-card__info">{info}</p>}

          <button className="btn btn--primary auth-form__submit" type="submit" disabled={busy || !configured}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <button className="link-btn auth-card__switch" type="button" onClick={toggleMode}>
          {mode === 'login' ? '¿No tenés cuenta? Crear una' : '¿Ya tenés cuenta? Iniciar sesión'}
        </button>
      </div>
    </div>
  );
}
