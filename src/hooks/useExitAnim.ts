import { useCallback, useState } from 'react';

/**
 * Animación de salida sencilla y reutilizable (Tanda 1 de efectos).
 *
 * Marca un id como "saliendo" para que el CSS lo desvanezca/colapse (clase `is-exiting`)
 * y, pasados `ms`, ejecuta la baja real. Es SOLO visual: demora la acción unos
 * milisegundos, no toca la lógica de datos ni la plata.
 *
 *   const { isExiting, removeWithAnim } = useExitAnim();
 *   <div className={`row${isExiting(id) ? ' is-exiting' : ''}`}>
 *   onClick={() => removeWithAnim(id, () => borrarDeVerdad(id))}
 */
export function useExitAnim(ms = 200) {
  const [exiting, setExiting] = useState<Record<string, true>>({});

  const isExiting = useCallback((id: string) => Boolean(exiting[id]), [exiting]);

  const removeWithAnim = useCallback(
    (id: string, done: () => void) => {
      setExiting((e) => ({ ...e, [id]: true }));
      window.setTimeout(() => {
        done();
        setExiting((e) => {
          const next = { ...e };
          delete next[id];
          return next;
        });
      }, ms);
    },
    [ms]
  );

  return { isExiting, removeWithAnim };
}
