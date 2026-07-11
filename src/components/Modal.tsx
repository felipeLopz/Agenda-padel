import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Modales con contenido más ancho (ej. agenda del día, buscador). */
  wide?: boolean;
}

/** Contenedor genérico para todos los paneles modales de la app, con apertura y cierre
 *  animados (fade + scale en escritorio, subida desde abajo en celular). */
export default function Modal({ title, onClose, children, wide }: ModalProps) {
  const [closing, setClosing] = useState(false);

  // Cierra con animación de salida (desde el overlay, la ✕ o Escape). Los botones
  // internos de los formularios (Guardar/Cancelar) siguen usando onClose directo.
  const requestClose = useCallback(() => {
    if (closing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [closing, onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  return (
    <div className={`modal-overlay${closing ? ' modal-overlay--closing' : ''}`} onClick={requestClose}>
      <div
        className={`modal${wide ? ' modal--wide' : ''}${closing ? ' modal--closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={requestClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
