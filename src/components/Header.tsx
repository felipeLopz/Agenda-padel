export type ViewMode = 'anual' | 'semanal' | 'alumnos' | 'caja';

interface HeaderProps {
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
  year: number;
  onChangeYear: (y: number) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

/** Barra superior: marca, tabs de vista, selector de año y acciones. */
export default function Header({ view, onChangeView, year, onChangeYear, onOpenSearch, onOpenSettings }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__logo" aria-hidden>
          🎾
        </span>
        <h1>Agenda de Pádel</h1>
      </div>

      <div className="app-header__tabs">
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
        <button className="btn btn--ghost" onClick={onOpenSearch}>
          🔍 Buscar alumno
        </button>
        <button className="btn btn--ghost" onClick={onOpenSettings}>
          ⚙ Configuración
        </button>
      </div>
    </header>
  );
}
