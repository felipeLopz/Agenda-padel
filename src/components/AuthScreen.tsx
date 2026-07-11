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
  // Si se registró y hay que confirmar el correo: guardamos a qué email se envió.
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setConfirmEmail(null);
    const mail = email.trim();
    if (!mail || !password) {
      setError('Completá tu email y tu contraseña.');
      return;
    }
    setBusy(true);

    if (mode === 'login') {
      const { error: err } = await signIn(mail, password);
      setBusy(false);
      if (err) setError(err);
      return;
    }

    const { error: err, needsConfirmation } = await signUp(mail, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (needsConfirmation) {
      // Hay que confirmar el correo. Mostramos el aviso y dejamos el formulario en
      // modo "Iniciar sesión" para cuando el usuario vuelva ya confirmado.
      setConfirmEmail(mail);
      setMode('login');
    }
    // Si no hace falta confirmar, la app entra sola (cambia la sesión).
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setConfirmEmail(null);
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
          <p className="auth-card__error">No pudimos conectar con el servidor. Probá de nuevo en un rato.</p>
        )}

        {/* Aviso destacado tras registrarse: hay que confirmar el correo. */}
        {confirmEmail && (
          <div className="auth-confirm" role="status">
            <span className="auth-confirm__icon" aria-hidden>
              📩
            </span>
            <p className="auth-confirm__title">¡Cuenta creada!</p>
            <p className="auth-confirm__text">
              Te enviamos un correo a <strong>{confirmEmail}</strong>. Revisá tu casilla (y la carpeta de spam)
              y confirmá tu cuenta antes de iniciar sesión.
            </p>
          </div>
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
