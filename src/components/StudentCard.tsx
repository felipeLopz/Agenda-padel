import { useRef, useState, type TouchEvent } from 'react';
import { displayName, CATEGORY_LABELS, RANK_LABELS } from '../lib/students';
import type { Student } from '../types';

interface StudentCardProps {
  student: Student;
  /** Cantidad de clases vinculadas (se muestra como referencia). */
  classes: number;
  onClick: () => void;
  /** Archiva / reactiva al deslizar la tarjeta hacia la izquierda (gesto de celular). */
  onArchive: () => void;
}

/** Cuánto hay que deslizar (px) para que se dispare el archivar. */
const SWIPE_THRESHOLD = 80;

/** Item de la lista de alumnos: foto, nombre, categoría/nivel y estado. */
export default function StudentCard({ student, classes, onClick, onArchive }: StudentCardProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; captured: boolean } | null>(null);
  const dxRef = useRef(0);
  const moved = useRef(false);

  function onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, captured: false };
    moved.current = false;
  }

  function onTouchMove(e: TouchEvent) {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const ddx = t.clientX - s.x;
    const ddy = t.clientY - s.y;
    if (!s.captured) {
      // Recién capturamos el gesto si es claramente horizontal; si es vertical, lo
      // soltamos para no romper el scroll de la lista.
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) {
        s.captured = true;
        setDragging(true);
      } else if (Math.abs(ddy) > 10) {
        start.current = null;
        return;
      } else {
        return;
      }
    }
    moved.current = true;
    const clamped = Math.max(-120, Math.min(0, ddx)); // solo hacia la izquierda
    dxRef.current = clamped;
    setDx(clamped);
  }

  function onTouchEnd() {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (s?.captured && dxRef.current <= -SWIPE_THRESHOLD) {
      onArchive();
    }
    dxRef.current = 0;
    setDx(0);
  }

  // Evita que un swipe cuente como tap (abrir ficha).
  function handleClick() {
    if (moved.current) {
      moved.current = false;
      return;
    }
    onClick();
  }

  return (
    <div className="swipe-wrap">
      <div className="swipe-bg" aria-hidden>
        <span className="swipe-bg__label">{student.active ? '🗄 Archivar' : '↩ Reactivar'}</span>
      </div>
      <button
        className={`student-card${student.active ? '' : ' student-card--inactive'}`}
        onClick={handleClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.2s ease' }}
      >
        <div className="student-avatar">
          {student.photo ? (
            <img src={student.photo} alt={displayName(student)} />
          ) : (
            <span className="student-avatar__initials">{(student.firstName[0] ?? '?').toUpperCase()}</span>
          )}
        </div>
        <div className="student-card__info">
          <span className="student-card__name">{displayName(student)}</span>
          <span className="student-card__meta">
            {student.category && <span className="badge badge--cat">{CATEGORY_LABELS[student.category]}</span>}
            {student.rank && <span className={`badge badge--rank-${student.rank}`}>{RANK_LABELS[student.rank]}</span>}
            <span className="student-card__classes">
              {classes} clase{classes === 1 ? '' : 's'}
            </span>
          </span>
        </div>
        {!student.active && <span className="student-card__archived">Archivado</span>}
      </button>
    </div>
  );
}
