import { useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { newId } from '../lib/id';
import {
  displayName,
  findStudentByName,
  makeStudentFromName,
  participantName,
  suggestStudents,
} from '../lib/students';
import type { ClassParticipant } from '../types';

interface StudentPickerProps {
  participant: ClassParticipant;
  /** Ids de otros participantes ya elegidos (para no sugerirlos de nuevo). */
  excludeIds: string[];
  placeholder?: string;
  onChange: (p: ClassParticipant) => void;
  onRemove?: () => void;
}

/**
 * Input con autocompletado de alumnos.
 * - Al escribir, sugiere fichas activas que coincidan.
 * - Al elegir una, la clase queda vinculada por `studentId`.
 * - Si el texto no coincide con nadie, permite crear la ficha al vuelo,
 *   o dejarlo como nombre suelto (studentId null) si no se crea.
 */
export default function StudentPicker({
  participant,
  excludeIds,
  placeholder,
  onChange,
  onRemove,
}: StudentPickerProps) {
  const { data, upsertStudent } = useAgenda();
  const [open, setOpen] = useState(false);

  // El texto visible se deriva del participante: para vinculados es el nombre
  // "en vivo" de la ficha; para sueltos, el texto tipeado.
  const text = participantName(participant, data.students);
  const linked = Boolean(participant.studentId && data.students[participant.studentId]);

  const suggestions = open ? suggestStudents(text, data.students, excludeIds) : [];
  const exactMatch = findStudentByName(text, data.students);
  const canCreate = open && text.trim().length > 0 && !exactMatch;

  function handleType(value: string) {
    // Tipear desvincula: pasa a ser un nombre suelto hasta que se elija/creé una ficha.
    // Se conserva el descuento puntual que tenga cargado el participante.
    onChange({ studentId: null, name: value, discount: participant.discount });
    if (!open) setOpen(true);
  }

  function pickStudent(id: string) {
    const student = data.students[id];
    onChange({ studentId: id, name: student ? displayName(student) : '', discount: participant.discount });
    setOpen(false);
  }

  function createStudent() {
    const student = makeStudentFromName(newId(), text.trim());
    upsertStudent(student);
    onChange({ studentId: student.id, name: displayName(student), discount: participant.discount });
    setOpen(false);
  }

  return (
    <div className="picker">
      <div className="picker__field">
        <input
          type="text"
          value={text === '—' ? '' : text}
          placeholder={placeholder ?? 'Nombre del alumno'}
          onChange={(e) => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        />
        {linked && <span className="picker__linked" title="Vinculado a una ficha">🔗</span>}
        {onRemove && (
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={onRemove}
            aria-label="Quitar alumno"
          >
            ✕
          </button>
        )}
      </div>

      {open && (suggestions.length > 0 || canCreate) && (
        <div className="picker__dropdown">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="picker__option"
              // onMouseDown en vez de onClick: se dispara antes del blur del input.
              onMouseDown={(e) => {
                e.preventDefault();
                pickStudent(s.id);
              }}
            >
              <span>{displayName(s)}</span>
              <span className="picker__option-hint">ficha existente</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="picker__option picker__option--create"
              onMouseDown={(e) => {
                e.preventDefault();
                createStudent();
              }}
            >
              + Crear ficha «{text.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
