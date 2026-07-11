import { displayName, LEVEL_LABELS } from '../lib/students';
import type { Student } from '../types';

interface StudentCardProps {
  student: Student;
  /** Cantidad de clases vinculadas (se muestra como referencia). */
  classes: number;
  onClick: () => void;
}

/** Item de la lista de alumnos: foto, nombre, nivel y estado. */
export default function StudentCard({ student, classes, onClick }: StudentCardProps) {
  return (
    <button className={`student-card${student.active ? '' : ' student-card--inactive'}`} onClick={onClick}>
      <div className="student-avatar">
        {student.photo ? (
          <img src={student.photo} alt={displayName(student)} />
        ) : (
          <span className="student-avatar__initials">
            {(student.firstName[0] ?? '?').toUpperCase()}
          </span>
        )}
      </div>
      <div className="student-card__info">
        <span className="student-card__name">{displayName(student)}</span>
        <span className="student-card__meta">
          <span className={`badge badge--level-${student.level}`}>{LEVEL_LABELS[student.level]}</span>
          <span className="student-card__classes">{classes} clase{classes === 1 ? '' : 's'}</span>
        </span>
      </div>
      {!student.active && <span className="student-card__archived">Archivado</span>}
    </button>
  );
}
