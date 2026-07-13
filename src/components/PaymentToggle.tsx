import { useAgenda } from '../state/AgendaContext';

interface PaymentToggleProps {
  day: string;
  /** Hora de inicio de la clase en minutos (su clave). */
  start: number;
  /** Alumno; null para un nombre suelto (sin ficha) → no se muestra nada. */
  studentId: string | null;
}

/**
 * Botones claros "Pagado: Sí / No" por alumno, para usar en CUALQUIER pantalla donde se
 * lista un turno (agenda del día, Hoy, formulario de clase). Reutiliza el cobro y la deuda
 * que YA existen: no duplica ni recalcula plata.
 *  - El ESTADO (verde = pagado / rojo = debe) sale del `ledger` vivo del contexto, así se ve
 *    igual en todas las vistas.
 *  - "Sí" → `collectClassStudent` (registra el pago de su parte, con la fecha de hoy).
 *  - "No" → `undoCollectClassStudent` (borra su pago de esa clase → queda deudor de esa parte,
 *    la MISMA deuda que se ve en la ficha, el ranking y la caja). Cambiar de opinión no duplica
 *    ni deja pagos colgados (ver AgendaContext).
 *
 * No muestra botones para alumnos sin ficha, ni para clases todavía sin guardar (no hay
 * participación en el ledger); si el alumno está cubierto por un pack prepago, muestra "pagado
 * con pack" (no se marca a mano).
 */
export default function PaymentToggle({ day, start, studentId }: PaymentToggleProps) {
  const { ledger, collectClassStudent, undoCollectClassStudent } = useAgenda();
  if (!studentId) return null;

  const part = ledger.byStudent[studentId]?.participations.find((p) => p.day === day && p.start === start);
  if (!part) return null; // clase no guardada / alumno no rastreado: no hay nada que cobrar
  if (part.coveredByPack) {
    return <span className="disc-tag disc-tag--pack">pagado con pack</span>;
  }

  const paid = part.status === 'pagada';
  return (
    <div className="pay-toggle" role="group" aria-label="¿Pagó este alumno?">
      <button
        type="button"
        className={`pay-toggle__btn pay-toggle__btn--yes${paid ? ' is-on' : ''}`}
        aria-pressed={paid}
        // Idempotente: si ya está pago, no hace nada (no duplica el pago).
        onClick={() => {
          if (!paid) collectClassStudent(day, start, studentId);
        }}
      >
        Pagado: Sí
      </button>
      <button
        type="button"
        className={`pay-toggle__btn pay-toggle__btn--no${!paid ? ' is-on' : ''}`}
        aria-pressed={!paid}
        // Cambiar de opinión: borra el pago de esta clase (no queda colgado) y vuelve a deber.
        onClick={() => {
          if (paid) undoCollectClassStudent(day, start, studentId);
        }}
      >
        Pagado: No
      </button>
    </div>
  );
}
