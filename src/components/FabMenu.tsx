import { useState } from 'react';

interface FabMenuProps {
  onNewClass: () => void;
  onNewStudent: () => void;
}

/**
 * Botón flotante (+) fijo abajo a la derecha que se abre en abanico con accesos
 * rápidos ("Nueva clase" / "Nuevo alumno"). Solo UI (Tanda 4).
 */
export default function FabMenu({ onNewClass, onNewStudent }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  function pick(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      {open && <div className="fab-backdrop" onClick={() => setOpen(false)} aria-hidden />}
      <div className={`fab${open ? ' fab--open' : ''}`}>
        <button className="fab__action fab__action--2" type="button" onClick={() => pick(onNewStudent)}>
          <span className="fab__label">Nuevo alumno</span>
          <span className="fab__ico">👤</span>
        </button>
        <button className="fab__action fab__action--1" type="button" onClick={() => pick(onNewClass)}>
          <span className="fab__label">Nueva clase</span>
          <span className="fab__ico">🎾</span>
        </button>
        <button
          className="fab__main"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Cerrar acciones rápidas' : 'Acciones rápidas'}
          aria-expanded={open}
        >
          +
        </button>
      </div>
    </>
  );
}
