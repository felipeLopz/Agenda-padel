import { useMemo, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import {
  countStudentClasses,
  displayName,
  LEVELS,
  LEVEL_LABELS,
  normalizeName,
} from '../lib/students';
import type { Student, StudentLevel } from '../types';
import StudentCard from './StudentCard';
import StudentProfileModal from './StudentProfileModal';
import StudentFormModal from './StudentFormModal';

interface StudentsViewProps {
  onOpenDay: (day: string) => void;
}

type StatusFilter = 'activos' | 'inactivos' | 'todos';
type LevelFilter = 'todos' | StudentLevel;

/** Sección "Alumnos": lista, filtros y acceso a fichas. */
export default function StudentsView({ onOpenDay }: StudentsViewProps) {
  const { data } = useAgenda();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('activos');
  const [level, setLevel] = useState<LevelFilter>('todos');

  const [profileId, setProfileId] = useState<string | null>(null);
  // formState: null = cerrado; { student } = editando (o null para alta).
  const [formState, setFormState] = useState<{ student: Student | null } | null>(null);

  const students = useMemo(() => {
    const q = normalizeName(query);
    return Object.values(data.students)
      .filter((s) => {
        if (status === 'activos' && !s.active) return false;
        if (status === 'inactivos' && s.active) return false;
        if (level !== 'todos' && s.level !== level) return false;
        if (q) {
          const inName = normalizeName(displayName(s)).includes(q);
          const inTags = s.tags.some((t) => normalizeName(t).includes(q));
          if (!inName && !inTags) return false;
        }
        return true;
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));
  }, [data.students, query, status, level]);

  return (
    <div className="students-view">
      <div className="students-view__toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por nombre o etiqueta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn--primary" onClick={() => setFormState({ student: null })}>
          + Nuevo alumno
        </button>
      </div>

      <div className="students-view__filters">
        <div className="segmented">
          {(['activos', 'inactivos', 'todos'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              className={`segmented__option${status === st ? ' segmented__option--active' : ''}`}
              onClick={() => setStatus(st)}
            >
              {st === 'activos' ? 'Activos' : st === 'inactivos' ? 'Inactivos' : 'Todos'}
            </button>
          ))}
        </div>
        <div className="segmented segmented--wrap">
          <button
            className={`segmented__option${level === 'todos' ? ' segmented__option--active' : ''}`}
            onClick={() => setLevel('todos')}
          >
            Todos
          </button>
          {LEVELS.map((lv) => (
            <button
              key={lv}
              className={`segmented__option${level === lv ? ' segmented__option--active' : ''}`}
              onClick={() => setLevel(lv)}
            >
              {LEVEL_LABELS[lv]}
            </button>
          ))}
        </div>
      </div>

      <div className="students-view__list">
        {students.map((s) => (
          <StudentCard
            key={s.id}
            student={s}
            classes={countStudentClasses(data, s.id)}
            onClick={() => setProfileId(s.id)}
          />
        ))}
        {students.length === 0 && (
          <p className="search-empty">
            {Object.keys(data.students).length === 0
              ? 'Todavía no hay alumnos. Creá el primero con "+ Nuevo alumno".'
              : 'Ningún alumno coincide con los filtros.'}
          </p>
        )}
      </div>

      {profileId && (
        <StudentProfileModal
          studentId={profileId}
          onClose={() => setProfileId(null)}
          onEdit={(student) => setFormState({ student })}
          onOpenDay={(day) => {
            setProfileId(null);
            onOpenDay(day);
          }}
        />
      )}

      {formState && (
        <StudentFormModal
          student={formState.student}
          onClose={() => setFormState(null)}
          onSaved={(student) => {
            // Al crear desde cero, abrimos su ficha recién guardada.
            if (!formState.student) setProfileId(student.id);
          }}
        />
      )}
    </div>
  );
}
