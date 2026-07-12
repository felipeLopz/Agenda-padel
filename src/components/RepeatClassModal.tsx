import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { classNames } from '../lib/students';
import { classRangeLabel } from '../lib/time';
import RecurrenceFields from './RecurrenceFields';
import type { RecurrenceInput } from '../lib/recurrence';

interface RepeatClassModalProps {
  day: string;
  /** Hora de inicio del turno en minutos (v10). */
  start: number;
  onClose: () => void;
}

/**
 * Convierte un turno YA existente en una serie recurrente sin rehacerlo. Usa la MISMA
 * recurrencia (cada X semanas, hasta una fecha o una cantidad) que al crear desde cero: el
 * turno original queda como la primera clase y se generan las repeticiones hacia adelante.
 */
export default function RepeatClassModal({ day, start, onClose }: RepeatClassModalProps) {
  const { data, makeSeriesFromClass } = useAgenda();
  const entry = data.days[day]?.[String(start)];
  // Recurrencia por defecto (igual que en el alta): cada 1 semana, 4 clases.
  const [recurrence, setRecurrence] = useState<RecurrenceInput>({ everyWeeks: 1, end: { type: 'count', count: 4 } });

  if (!entry) {
    onClose();
    return null;
  }

  const date = parseDayKey(day);
  const label = classNames(entry, data.students).join(', ') || `${entry.participants.length} alumno(s)`;

  function handleRepeat() {
    const res = makeSeriesFromClass(day, start, recurrence);
    if (res.created === 0) {
      // Todas las fechas elegidas se solapan con turnos existentes, o se eligió una sola.
      alert(
        'No se creó ninguna repetición: las fechas elegidas se solapan con turnos existentes, o elegiste una sola clase. Probá otra cantidad o revisá los horarios.'
      );
      return;
    }
    let msg = `Serie creada: ${res.created} repetición(es) nueva(s), además de este turno.`;
    if (res.skipped > 0) {
      msg += ` Se omitieron ${res.skipped} porque se solapaban con otra clase (esas no se crearon).`;
    }
    alert(msg);
    onClose();
  }

  return (
    <Modal title="Repetir turno" onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Convertir «{label}» del {WEEKDAY_NAMES_LONG[date.getDay()]} {date.getDate()}/{date.getMonth() + 1} ·{' '}
          {classRangeLabel(start, entry)} en una serie. Este turno queda igual (será la primera clase) y se crean las
          repeticiones hacia adelante, copiando alumnos, precios, duración, horario, tipo y contenido. Las que se
          solapen con un turno ya existente se omiten. La plata de cada clase es independiente.
        </p>

        <RecurrenceFields startDay={day} onChange={setRecurrence} />

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleRepeat}>
            Crear serie
          </button>
        </div>
      </div>
    </Modal>
  );
}
