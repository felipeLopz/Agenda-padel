import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { classNames } from '../lib/students';
import { classRangeLabel } from '../lib/time';

interface RepeatClassModalProps {
  day: string;
  /** Hora de inicio del turno en minutos (v10). */
  start: number;
  onClose: () => void;
}

/**
 * Convierte un turno YA existente en un TURNO FIJO SEMANAL (serie viva, v15): se repite
 * todas las semanas, el mismo día y a la misma hora, sin fecha de fin, hasta que el profe
 * lo corte.
 *
 * No genera clases por adelantado: guarda la regla y las repeticiones aparecen solas al
 * navegar la agenda. Las que ya vencieron se convierten en clases reales al abrir la app,
 * así se cobran como cualquier otra.
 */
export default function RepeatClassModal({ day, start, onClose }: RepeatClassModalProps) {
  const { data, makeSeriesLive } = useAgenda();
  const dialog = useDialog();
  const entry = data.days[day]?.[String(start)];

  if (!entry) {
    onClose();
    return null;
  }

  const date = parseDayKey(day);
  const weekday = WEEKDAY_NAMES_LONG[date.getDay()];
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  function handleRepeat() {
    const id = makeSeriesLive(day, start);
    if (!id) {
      void dialog.alert('No se pudo hacer fijo este turno. Probá cerrando y volviendo a abrir la agenda.');
      return;
    }
    void dialog.alert(
      `Listo: «${label}» queda fijo todos los ${weekday.toLowerCase()} a las ${classRangeLabel(start, entry)}, ` +
        'sin fecha de fin. Cuando quieras cortarlo, usá ✂ "Terminar serie" y elegís desde qué fecha.'
    );
    onClose();
  }

  return (
    <Modal title="Hacer fijo todas las semanas" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          «{label}» pasa a repetirse <strong>todos los {weekday.toLowerCase()}</strong> a las{' '}
          {classRangeLabel(start, entry)}, <strong>sin fecha de fin</strong>, copiando alumnos, tipo, precios,
          duración y contenido. Este turno queda igual (será el primero de la serie).
        </p>
        <p className="settings__hint">
          Cada semana es una clase aparte: su plata, su asistencia y sus recordatorios son independientes. Podés
          editar o borrar una sola semana sin tocar las demás, y cortar la serie desde la fecha que quieras
          conservando todo lo anterior.
        </p>

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleRepeat}>
            Hacer fijo semanal
          </button>
        </div>
      </div>
    </Modal>
  );
}
