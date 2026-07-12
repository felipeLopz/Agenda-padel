interface AttendanceToggleProps {
  /** true = vino, false = no vino, undefined = sin marcar. */
  attended: boolean | undefined;
  onChange: (attended: boolean | undefined) => void;
}

/**
 * Par de botones chicos "vino ✓ / no vino ✗" para marcar la asistencia de un alumno con un
 * solo toque (pensado para el celular). Tocar el que ya está activo lo deja "sin marcar".
 * Es solo un registro: NO cambia la plata (lo maneja `setAttendance`).
 */
export default function AttendanceToggle({ attended, onChange }: AttendanceToggleProps) {
  return (
    <span className="attendance" role="group" aria-label="Asistencia">
      <button
        type="button"
        className={`attendance__btn attendance__btn--yes${attended === true ? ' attendance__btn--on' : ''}`}
        title="Vino"
        aria-label="Vino"
        aria-pressed={attended === true}
        onClick={() => onChange(attended === true ? undefined : true)}
      >
        ✓
      </button>
      <button
        type="button"
        className={`attendance__btn attendance__btn--no${attended === false ? ' attendance__btn--on' : ''}`}
        title="No vino"
        aria-label="No vino"
        aria-pressed={attended === false}
        onClick={() => onChange(attended === false ? undefined : false)}
      >
        ✗
      </button>
    </span>
  );
}
