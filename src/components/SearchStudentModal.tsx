import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { WEEKDAY_NAMES } from '../lib/constants';
import { classNames, normalizeName } from '../lib/students';
import { grossShare, shareBreakdown, STATUS_LABEL, type ClassStatus } from '../lib/money';
import type { ClassType } from '../types';

interface SearchStudentModalProps {
  onClose: () => void;
  onOpenDay: (day: string) => void;
}

interface SearchResult {
  day: string;
  hour: number;
  type: ClassType;
  /** Parte prorrateada NETA del alumno en esa clase. */
  share: number;
  status: ClassStatus;
}

/**
 * Búsqueda rápida por texto en todas las clases. Muestra la parte NETA de cada
 * alumno (tras descuentos) y su estado de cobro, resuelto contra la base y los
 * pagos, para que los montos coincidan con la ficha.
 */
export default function SearchStudentModal({ onClose, onOpenDay }: SearchStudentModalProps) {
  const { data, ledger } = useAgenda();
  const [query, setQuery] = useState('');

  const results = useMemo<SearchResult[]>(() => {
    const q = normalizeName(query);
    if (!q) return [];
    const found: SearchResult[] = [];
    for (const [day, slots] of Object.entries(data.days)) {
      for (const [hourStr, entry] of Object.entries(slots)) {
        const hour = Number(hourStr);
        const names = classNames(entry, data.students);
        const idx = names.findIndex((n) => normalizeName(n).includes(q));
        if (idx < 0) continue;
        const p = entry.participants[idx];
        if (p.studentId) {
          const part = ledger.byStudent[p.studentId]?.participations.find(
            (pp) => pp.day === day && pp.hour === hour
          );
          found.push({ day, hour, type: entry.type, share: part?.net ?? grossShare(entry), status: part?.status ?? 'impaga' });
        } else {
          // Nombre suelto: no se rastrea la plata.
          found.push({ day, hour, type: entry.type, share: shareBreakdown(entry, idx, undefined).net, status: 'sin-seguimiento' });
        }
      }
    }
    return found.sort((a, b) => {
      const da = parseDayKey(a.day).getTime();
      const db = parseDayKey(b.day).getTime();
      return da !== db ? da - db : a.hour - b.hour;
    });
  }, [query, data.days, data.students, ledger]);

  const summary = results.reduce(
    (acc, r) => ({
      total: acc.total + r.share,
      pagadas: acc.pagadas + (r.status === 'pagada' ? 1 : 0),
      pendientes: acc.pendientes + (r.status === 'impaga' || r.status === 'parcial' ? 1 : 0),
    }),
    { total: 0, pagadas: 0, pendientes: 0 }
  );

  const trimmed = query.trim();

  return (
    <Modal title="Buscar alumno" onClose={onClose} wide>
      <input
        className="search-input"
        type="text"
        autoFocus
        placeholder="Escribí un nombre..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {trimmed && (
        <div className="search-summary">
          <span>
            Clases: <strong>{results.length}</strong>
          </span>
          <span>
            Total (su parte): <strong>{formatCurrency(summary.total)}</strong>
          </span>
          <span className="text-paid">
            Pagadas: <strong>{summary.pagadas}</strong>
          </span>
          <span className="text-pending">
            Pendientes: <strong>{summary.pendientes}</strong>
          </span>
        </div>
      )}

      <div className="search-results">
        {results.map((r) => {
          const date = parseDayKey(r.day);
          return (
            <button key={`${r.day}-${r.hour}`} className="search-result" onClick={() => onOpenDay(r.day)}>
              <span>
                {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} ·{' '}
                {r.hour}:00
              </span>
              <span className={`badge badge--${r.type}`}>{r.type === 'grupal' ? 'Grupal' : 'Individual'}</span>
              <span title="Parte prorrateada de este alumno">{formatCurrency(r.share)}</span>
              <span className={`chip chip--status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
            </button>
          );
        })}
        {trimmed && results.length === 0 && (
          <p className="search-empty">No se encontraron clases para "{trimmed}".</p>
        )}
      </div>
    </Modal>
  );
}
