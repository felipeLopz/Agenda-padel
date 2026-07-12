import { useAgenda } from '../state/AgendaContext';
import { useAuth } from '../state/AuthContext';

export type ViewMode = 'hoy' | 'anual' | 'semanal' | 'alumnos' | 'caja' | 'stats';

/** Nombre "lindo" a partir del email (primer token de letras), o vacío si no se puede. */
function nameFromEmail(email?: string | null): string {
  if (!email) return '';
  const token = email.split('@')[0].split(/[^a-záéíóúñ]+/i)[0] ?? '';
  return token.length >= 2 ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : '';
}

/** Saludo según la hora del día. */
function greetingFor(date: Date): string {
  const h = date.getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

interface HeaderProps {
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
  year: number;
  onChangeYear: (y: number) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  /** Cantidad de recordatorios pendientes (para el número de la campana). */
  reminderCount: number;
  onOpenReminders: () => void;
}

/** Barra superior: marca, tabs de vista, selector de año y acciones. */
export default function Header({
  view,
  onChangeView,
  year,
  onChangeYear,
  onOpenSearch,
  onOpenSettings,
  reminderCount,
  onOpenReminders,
}: HeaderProps) {
  const { data, setTheme } = useAgenda();
  const { user } = useAuth();
  const theme = data.settings.theme ?? 'dark';
  const name = nameFromEmail(user?.email);
  const greeting = name ? `${greetingFor(new Date())}, ${name}` : greetingFor(new Date());
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden>
          🎾
        </span>
        <div className="app-header__title">
          <h1>Agenda de Pádel</h1>
          <span className="app-header__greeting">{greeting}</span>
        </div>
      </div>

      <div className="app-header__tabs">
        <button
          className={`tab${view === 'hoy' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('hoy')}
        >
          Hoy
        </button>
        <button
          className={`tab${view === 'anual' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('anual')}
        >
          Anual
        </button>
        <button
          className={`tab${view === 'semanal' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('semanal')}
        >
          Semanal
        </button>
        <button
          className={`tab${view === 'alumnos' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('alumnos')}
        >
          Alumnos
        </button>
        <button
          className={`tab${view === 'caja' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('caja')}
        >
          Caja
        </button>
        <button
          className={`tab${view === 'stats' ? ' tab--active' : ''}`}
          onClick={() => onChangeView('stats')}
        >
          Stats
        </button>
      </div>

      {view === 'anual' && (
        <div className="app-header__year">
          <button className="icon-btn" onClick={() => onChangeYear(year - 1)} aria-label="Año anterior">
            ←
          </button>
          <span className="app-header__year-label">{year}</span>
          <button className="icon-btn" onClick={() => onChangeYear(year + 1)} aria-label="Año siguiente">
            →
          </button>
        </div>
      )}

      <div className="app-header__actions">
        <button
          className="btn btn--ghost app-header__bell has-tip"
          data-tip="Recordatorios"
          aria-label="Recordatorios"
          onClick={onOpenReminders}
        >
          🔔
          {reminderCount > 0 && <span className="app-header__badge">{reminderCount}</span>}
        </button>
        <button className="btn btn--ghost" onClick={onOpenSearch}>
          🔍 Buscar
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button className="btn btn--ghost" onClick={onOpenSettings}>
          ⚙ Configuración
        </button>
      </div>
    </header>
  );
}
