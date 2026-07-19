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

/** Una opción de `choose`: el texto del botón, una aclaración opcional y si es peligrosa. */
export interface ChooseOption<T extends string> {
  value: T;
  label: string;
  /** Línea chica debajo del botón, para explicar qué hace sin llenar el mensaje. */
  hint?: string;
  /** Acción destructiva: el botón va en rojo. */
  danger?: boolean;
}

interface ChooseOptions {
  title?: string;
  cancelLabel?: string;
}

interface DialogApi {
  /** Aviso simple con un solo botón. Se resuelve cuando el usuario lo cierra. */
  alert: (message: string, opts?: AlertOptions) => Promise<void>;
  /** Confirmación con dos botones. Se resuelve en true (confirmó) o false (canceló). */
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  /**
   * Elección entre varias opciones (además de Cancelar). Se resuelve con el `value` de la
   * opción elegida, o null si canceló. Los botones se apilan, así que en el celular quedan
   * grandes y fáciles de tocar.
   */
  choose: <T extends string>(message: string, options: ChooseOption<T>[], opts?: ChooseOptions) => Promise<T | null>;
}

interface DialogState {
  kind: 'alert' | 'confirm' | 'choose';
  message: string;
  title?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  /** Opciones cuando `kind` es 'choose'. */
  options?: ChooseOption<string>[];
  /** true/false en alert y confirm; el value elegido (o null) en choose. */
  resolve: (value: boolean | string | null) => void;
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
            resolve: resolve as (v: boolean | string | null) => void,
          });
        }),
      choose: <T extends string>(message: string, options: ChooseOption<T>[], opts?: ChooseOptions) =>
        new Promise<T | null>((resolve) => {
          setState({
            kind: 'choose',
            message,
            title: opts?.title,
            confirmLabel: '',
            cancelLabel: opts?.cancelLabel ?? 'Cancelar',
            danger: false,
            options: options as ChooseOption<string>[],
            resolve: resolve as (v: boolean | string | null) => void,
          });
        }),
    }),
    []
  );

  // Cierra el diálogo actual devolviendo la elección (y limpia el estado).
  const respond = useCallback((value: boolean | string | null) => {
    setState((cur) => {
      cur?.resolve(value);
      return null;
    });
  }, []);

  // Teclado, como los carteles nativos: Enter = confirmar/aceptar, Escape = cancelar/cerrar.
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      // En una elección múltiple no hay un "sí" obvio, así que Enter no elige nada:
      // solo Escape cancela (devuelve null). En alert/confirm sigue igual que antes.
      const cancelValue = state?.kind === 'choose' ? null : false;
      if (e.key === 'Escape') respond(cancelValue);
      else if (e.key === 'Enter' && state?.kind !== 'choose') respond(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, respond]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {state && (
        // Tocar el fondo: en un aviso lo cierra; en una confirmación equivale a cancelar.
        <div
          className="dialog-overlay"
          onClick={() => respond(state.kind === 'alert' ? true : state.kind === 'choose' ? null : false)}
          role="presentation"
        >
          <div className="dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {state.title && <h3 className="dialog__title">{state.title}</h3>}
            <p className="dialog__message">{state.message}</p>
            {state.kind === 'choose' ? (
              // Botones apilados y grandes: en el celular cada opción se toca cómoda y se
              // lee entera, con su aclaración debajo.
              <div className="dialog__actions dialog__actions--stacked">
                {state.options?.map((opt) => (
                  <button
                    key={opt.value}
                    className={`btn dialog__btn dialog__btn--option ${opt.danger ? 'btn--danger' : 'btn--primary'}`}
                    onClick={() => respond(opt.value)}
                  >
                    <span className="dialog__btn-label">{opt.label}</span>
                    {opt.hint && <span className="dialog__btn-hint">{opt.hint}</span>}
                  </button>
                ))}
                <button className="btn btn--ghost dialog__btn" onClick={() => respond(null)}>
                  {state.cancelLabel}
                </button>
              </div>
            ) : (
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
            )}
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
