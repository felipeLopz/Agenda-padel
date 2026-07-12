import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// Reemplazo de los carteles nativos del navegador (alert()/confirm()) por avisos propios
// con el tema de la app. La API es asíncrona (devuelve Promesas) porque, a diferencia de los
// nativos, no bloquea el hilo: `await dialog.confirm(...)` espera la elección del usuario y
// recién ahí sigue, así "Cancelar" cancela de verdad y "Aceptar/Borrar" continúa la acción.

interface AlertOptions {
  title?: string;
  confirmLabel?: string;
}
interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción peligrosa (borrar, reemplazar): el botón de confirmar se muestra en rojo. */
  danger?: boolean;
}

interface DialogApi {
  /** Aviso simple con un solo botón. Se resuelve cuando el usuario lo cierra. */
  alert: (message: string, opts?: AlertOptions) => Promise<void>;
  /** Confirmación con dos botones. Se resuelve en true (confirmó) o false (canceló). */
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
}

interface DialogState {
  kind: 'alert' | 'confirm';
  message: string;
  title?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

/** Provee `useDialog()` a toda la app y renderiza el aviso/confirmación por encima de todo. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      alert: (message, opts) =>
        new Promise<void>((resolve) => {
          setState({
            kind: 'alert',
            message,
            title: opts?.title,
            confirmLabel: opts?.confirmLabel ?? 'Aceptar',
            cancelLabel: '',
            danger: false,
            resolve: () => resolve(),
          });
        }),
      confirm: (message, opts) =>
        new Promise<boolean>((resolve) => {
          setState({
            kind: 'confirm',
            message,
            title: opts?.title,
            confirmLabel: opts?.confirmLabel ?? 'Aceptar',
            cancelLabel: opts?.cancelLabel ?? 'Cancelar',
            danger: opts?.danger ?? false,
            resolve,
          });
        }),
    }),
    []
  );

  // Cierra el diálogo actual devolviendo la elección (y limpia el estado).
  const respond = useCallback((value: boolean) => {
    setState((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  // Teclado, como los carteles nativos: Enter = confirmar/aceptar, Escape = cancelar/cerrar.
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') respond(false);
      else if (e.key === 'Enter') respond(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, respond]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        // Tocar el fondo: en un aviso lo cierra; en una confirmación equivale a cancelar.
        <div className="dialog-overlay" onClick={() => respond(state.kind === 'alert')} role="presentation">
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {state.title && <h3 className="dialog__title">{state.title}</h3>}
            <p className="dialog__message">{state.message}</p>
            <div className="dialog__actions">
              {state.kind === 'confirm' && (
                <button className="btn btn--ghost dialog__btn" onClick={() => respond(false)}>
                  {state.cancelLabel}
                </button>
              )}
              <button
                className={`btn dialog__btn ${state.danger ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => respond(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>');
  return ctx;
}
