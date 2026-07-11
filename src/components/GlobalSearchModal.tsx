import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { WEEKDAY_NAMES } from '../lib/constants';
import { classNames, displayName, normalizeName } from '../lib/students';
import type { ClassType, Student } from '../types';

interface GlobalSearchModalProps {
  onClose: () => void;
  onOpenStudent: (studentId: string) => void;
  onOpenDay: (day: string) => void;
}

interface ClassHit {
  day: string;
  hour: number;
  type: ClassType;
  names: string;
}
interface PayHit {
  id: string;
  studentId: string;
  date: string;
  amount: number;
  concept: string;
}

const LIMIT = 8;

/** Buscador general: alumnos, clases y pagos a la vez, con navegación al resultado. */
export default function GlobalSearchModal({ onClose, onOpenStudent, onOpenDay }: GlobalSearchModalProps) {
  const { data } = useAgenda();
  const [query, setQuery] = useState('');
  const q = normalizeName(query);
  const digits = query.replace(/\D/g, '');

  const students = useMemo<Student[]>(() => {
    if (!q) return [];
    return Object.values(data.students)
      .filter(
        (s) => normalizeName(displayName(s)).includes(q) || s.tags.some((t) => normalizeName(t).includes(q))
      )
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'))
      .slice(0, LIMIT);
  }, [q, data.students]);

  const classes = useMemo<ClassHit[]>(() => {
    if (!q) return [];
    const hits: ClassHit[] = [];
    for (const [day, slots] of Object.entries(data.days)) {
      for (const [hourStr, entry] of Object.entries(slots)) {
        const names = classNames(entry, data.students);
        const topics = entry.content ?? [];
        const matches =
          names.some((n) => normalizeName(n).includes(q)) ||
          topics.some((t) => normalizeName(t).includes(q));
        if (matches) hits.push({ day, hour: Number(hourStr), type: entry.type, names: names.join(', ') });
      }
    }
    return hits
      .sort((a, b) => parseDayKey(b.day).getTime() - parseDayKey(a.day).getTime() || b.hour - a.hour)
      .slice(0, LIMIT);
  }, [q, data.days, data.students]);

  const payments = useMemo<PayHit[]>(() => {
    if (!q) return [];
    return Object.values(data.payments)
      .filter((p) => {
        const name = data.students[p.studentId] ? normalizeName(displayName(data.students[p.studentId])) : '';
        const concept = normalizeName(p.concept ?? '');
        const amountMatch = digits.length > 0 && String(Math.round(p.amount)).includes(digits);
        return name.includes(q) || concept.includes(q) || amountMatch;
      })
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, LIMIT)
      .map((p) => ({ id: p.id, studentId: p.studentId, date: p.date, amount: p.amount, concept: p.concept ?? '' }));
  }, [q, digits, data.payments, data.students]);

  const nothing = q && students.length === 0 && classes.length === 0 && payments.length === 0;

  return (
    <Modal title="Buscar" onClose={onClose} wide>
      <input
        className="search-input"
        type="text"
        autoFocus
        placeholder="Alumno, clase, tema o pago..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {students.length > 0 && (
        <div className="search-group">
          <span className="search-group__title">Alumnos</span>
          {students.map((s) => (
            <button key={s.id} className="search-result" onClick={() => onOpenStudent(s.id)}>
              <span>{displayName(s)}</span>
              {!s.active && <span className="chip chip--status-impaga chip--mini">Archivado</span>}
            </button>
          ))}
        </div>
      )}

      {classes.length > 0 && (
        <div className="search-group">
          <span className="search-group__title">Clases</span>
          {classes.map((c) => {
            const date = parseDayKey(c.day);
            return (
              <button key={`${c.day}-${c.hour}`} className="search-result" onClick={() => onOpenDay(c.day)}>
                <span>
                  {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} ·{' '}
                  {c.hour}:00
                </span>
                <span className={`badge badge--${c.type}`}>{c.type === 'grupal' ? 'Grupal' : 'Individual'}</span>
                <span className="search-result__sub">{c.names}</span>
              </button>
            );
          })}
        </div>
      )}

      {payments.length > 0 && (
        <div className="search-group">
          <span className="search-group__title">Pagos</span>
          {payments.map((p) => (
            <button key={p.id} className="search-result" onClick={() => onOpenStudent(p.studentId)}>
              <span>{p.date.split('-').reverse().join('/')}</span>
              <span className="payment-row__amount">{formatCurrency(p.amount)}</span>
              <span className="search-result__sub">
                {data.students[p.studentId] ? displayName(data.students[p.studentId]) : 'Alumno'}
                {p.concept ? ` · ${p.concept}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {nothing && <p className="search-empty">No se encontró nada para "{query.trim()}".</p>}
    </Modal>
  );
}
