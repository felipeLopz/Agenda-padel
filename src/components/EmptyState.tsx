import type { ReactNode } from 'react';

/** Ilustración simple (raqueta + pelota) para los estados vacíos. */
function RacketArt() {
  return (
    <svg viewBox="0 0 64 64" className="empty-state__svg" aria-hidden role="img">
      <ellipse cx="25" cy="23" rx="15" ry="18" fill="none" stroke="var(--blue-light)" strokeWidth="3" />
      <line x1="14" y1="37" x2="7" y2="57" stroke="var(--blue-light)" strokeWidth="4" strokeLinecap="round" />
      <line x1="18" y1="12" x2="32" y2="34" stroke="var(--blue-light)" strokeWidth="1.4" opacity="0.6" />
      <line x1="32" y1="10" x2="20" y2="34" stroke="var(--blue-light)" strokeWidth="1.4" opacity="0.6" />
      <line x1="12" y1="20" x2="38" y2="26" stroke="var(--blue-light)" strokeWidth="1.4" opacity="0.6" />
      <circle cx="48" cy="42" r="7" fill="var(--orange)" />
      <path d="M42 40 q6 3 12 0" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.8" />
    </svg>
  );
}

/**
 * Estado vacío amable: ilustración + mensaje + acción opcional. Se usa cuando todavía
 * no hay alumnos, clases o pagos, en vez de dejar un espacio en blanco.
 */
export default function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__art">{icon ?? <RacketArt />}</div>
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
