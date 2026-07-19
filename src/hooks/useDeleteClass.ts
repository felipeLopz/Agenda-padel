import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import type { ClassEntry } from '../types';

/**
 * Flujo ÚNICO de "Borrar turno", compartido por la agenda del día y la edición de la clase,
 * para que el botón se comporte igual en los dos lados (antes había dos caminos distintos).
 *
 * Funciona como un calendario:
 *  - Clase suelta: se borra directo, con la confirmación de siempre.
 *  - Clase de una serie: se pregunta el alcance, con dos opciones.
 *      · "Solo esta clase"       → se borra únicamente esta aparición.
 *      · "Esta y las siguientes" → se corta la serie DESDE esta fecha.
 *
 * A propósito NO existe "toda la serie": borraría el historial pasado (con su plata y su
 * asistencia) de un solo toque, que es justo lo que no queremos que pase por accidente. Para
 * borrar el pasado hay que ir clase por clase, que es deliberado.
 *
 * Devuelve true si se borró algo (para que el llamador cierre el modal, por ejemplo).
 */
export function useDeleteClassFlow() {
  const { deleteClass, deleteSeriesOccurrence, endSeriesFrom } = useAgenda();
  const dialog = useDialog();

  return async function confirmAndDelete(day: string, start: number, entry: ClassEntry): Promise<boolean> {
    if (entry.seriesId) {
      const alcance = await dialog.choose(
        'Elegí qué querés borrar. Las clases anteriores a esta fecha no se tocan en ningún caso: quedan con sus pagos, su asistencia y su historial.',
        [
          {
            value: 'una',
            label: 'Solo esta clase',
            hint: 'Se borra únicamente esta semana. El resto de la serie sigue igual, antes y después.',
            danger: true,
          },
          {
            value: 'siguientes',
            label: 'Esta y las siguientes',
            hint: 'La serie termina acá: se borran esta y las posteriores, y no vuelven a aparecer.',
            danger: true,
          },
        ],
        { title: 'Este turno se repite. ¿Qué querés borrar?' }
      );

      if (alcance === 'una') {
        // Si la repetición todavía es virtual no hay fila que borrar, así que se anota la
        // fecha como salteada en la regla. `deleteSeriesOccurrence` resuelve los dos casos.
        deleteSeriesOccurrence(day, start);
        return true;
      }

      if (alcance === 'siguientes') {
        // Corte de VERDAD: `endSeriesFrom` le pone fin a la REGLA (until = esta fecha) además
        // de borrar las clases ya materializadas desde acá. Por eso las repeticiones no
        // reaparecen al navegar la agenda ni al recargar. Lo anterior no se toca.
        const res = endSeriesFrom(entry.seriesId, day);
        void dialog.alert(
          'Listo: la serie termina acá y no se repite más.' +
            (res.removed > 0 ? ` Se borraron ${res.removed} clase(s) desde esta fecha.` : '') +
            (res.kept > 0 ? ` Las ${res.kept} anteriores quedaron intactas.` : '')
        );
        return true;
      }

      return false; // canceló
    }

    const ok = await dialog.confirm('¿Borrar este turno entero? Podés deshacerlo con el botón "Deshacer".', {
      danger: true,
      confirmLabel: 'Borrar turno',
    });
    if (ok) deleteClass(day, start);
    return ok;
  };
}
