import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { WEEKDAY_NAMES } from '../lib/constants';
import { displayName, LEVEL_LABELS, whatsappLink } from '../lib/students';
import { describeDiscount } from '../lib/discount';
import { STATUS_LABEL, studentPayments, studentPacks } from '../lib/money';
import { downloadReceipt } from '../lib/receipt';
import type { Student } from '../types';
import PaymentFormModal from './PaymentFormModal';
import PackFormModal from './PackFormModal';

interface StudentProfileModalProps {
  studentId: string;
  onClose: () => void;
  onEdit: (student: Student) => void;
  onOpenDay: (day: string) => void;
}

/** Ficha completa del alumno: datos, saldo, packs, historial de clases y de pagos. */
export default function StudentProfileModal({ studentId, onClose, onEdit, onOpenDay }: StudentProfileModalProps) {
  const { data, ledger, setStudentActive, deletePayment, deletePack } = useAgenda();
  const student = data.students[studentId];
  const [payOpen, setPayOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);

  if (!student) {
    onClose();
    return null;
  }

  const account = ledger.byStudent[studentId];
  const balance = account?.balance ?? 0;
  const participations = account?.participations ?? [];
  const payments = studentPayments(data, studentId);
  const packs = studentPacks(ledger, studentId);
  const wa = whatsappLink(student.phone);
  const methodLabel = (id: string) => data.paymentMethods.find((m) => m.id === id)?.label ?? id;

  return (
    <Modal title={displayName(student)} onClose={onClose} wide>
      <div className="profile">
        <div className="profile__header">
          <div className="student-avatar student-avatar--lg">
            {student.photo ? (
              <img src={student.photo} alt={displayName(student)} />
            ) : (
              <span className="student-avatar__initials">{(student.firstName[0] ?? '?').toUpperCase()}</span>
            )}
          </div>
          <div className="profile__meta">
            <span className={`badge badge--level-${student.level}`}>{LEVEL_LABELS[student.level]}</span>
            {!student.active && <span className="chip chip--status-impaga">Archivado</span>}
            {student.discount && (
              <span className="disc-tag disc-tag--fija">Descuento fijo −{describeDiscount(student.discount)}</span>
            )}
            {student.phone && <div className="profile__phone">📞 {student.phone}</div>}
            {student.birthday && <div className="profile__birthday">🎂 {formatBirthday(student.birthday)}</div>}
          </div>
          <div className="profile__balance">
            <span>Saldo</span>
            <strong className={balance > 0.5 ? 'text-pending' : 'text-paid'}>{formatCurrency(balance)}</strong>
          </div>
        </div>

        {student.tags.length > 0 && (
          <div className="profile__tags">
            {student.tags.map((t) => (
              <span key={t} className="tag-chip tag-chip--static">
                {t}
              </span>
            ))}
          </div>
        )}

        {student.notes && (
          <div className="profile__notes">
            <span className="profile__section-title">Notas</span>
            <p>{student.notes}</p>
          </div>
        )}

        <div className="profile__actions">
          <button className="btn btn--primary" onClick={() => setPayOpen(true)}>
            💵 Registrar pago
          </button>
          <button className="btn" onClick={() => setPackOpen(true)}>
            🎟 Nuevo pack
          </button>
          {wa && (
            <a className="btn btn--ghost" href={wa} target="_blank" rel="noopener noreferrer">
              💬 WhatsApp
            </a>
          )}
          <button className="btn btn--ghost" onClick={() => onEdit(student)}>
            ✎ Editar
          </button>
          <button className="btn btn--ghost" onClick={() => setStudentActive(student.id, !student.active)}>
            {student.active ? '📦 Archivar' : '↩ Reactivar'}
          </button>
        </div>

        {/* Packs */}
        {packs.length > 0 && (
          <div className="profile__packs">
            <span className="profile__section-title">Packs</span>
            {packs.map((st) => (
              <div
                key={st.pack.id}
                className={`pack-row${st.empty ? ' pack-row--empty' : st.low ? ' pack-row--low' : ''}`}
              >
                <span className="pack-row__count">
                  {st.remaining}/{st.pack.totalClasses} clases
                </span>
                <span className="pack-row__status">
                  {st.empty ? 'Agotado' : st.low ? 'Por agotarse' : 'Activo'}
                </span>
                <span className="pack-row__date">desde {st.pack.purchaseDate.split('-').reverse().join('/')}</span>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => {
                    if (confirm('¿Borrar el pack y su pago de compra?')) deletePack(st.pack.id);
                  }}
                  aria-label="Borrar pack"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Historial de pagos */}
        <div className="profile__history">
          <span className="profile__section-title">Pagos ({payments.length})</span>
          <div className="search-results">
            {payments.map((p) => (
              <div key={p.id} className="payment-row">
                <span>{p.date.split('-').reverse().join('/')}</span>
                <span className="payment-row__amount">{formatCurrency(p.amount)}</span>
                <span className="payment-row__method">{methodLabel(p.methodId)}</span>
                {p.kind === 'pack' && <span className="disc-tag disc-tag--pack">pack</span>}
                <button
                  className="btn btn--tiny btn--ghost"
                  onClick={() => downloadReceipt({ payment: p, student, methodLabel: methodLabel(p.methodId) })}
                >
                  Recibo
                </button>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => {
                    if (confirm('¿Borrar este pago?')) deletePayment(p.id);
                  }}
                  aria-label="Borrar pago"
                >
                  🗑
                </button>
              </div>
            ))}
            {payments.length === 0 && <p className="search-empty">Sin pagos registrados.</p>}
          </div>
        </div>

        {/* Historial de clases */}
        <div className="profile__history">
          <span className="profile__section-title">Clases ({participations.length})</span>
          <div className="search-results">
            {participations.map((it) => {
              const date = parseDayKey(it.day);
              return (
                <button
                  key={`${it.day}-${it.hour}`}
                  className="search-result"
                  onClick={() => onOpenDay(it.day)}
                >
                  <span>
                    {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} ·{' '}
                    {it.hour}:00
                  </span>
                  <span className={`badge badge--${it.entry.type}`}>
                    {it.entry.type === 'grupal' ? 'Grupal' : 'Individual'}
                  </span>
                  <span title="Parte de este alumno">{formatCurrency(it.net)}</span>
                  {it.coveredByPack ? (
                    <span className="disc-tag disc-tag--pack">pack</span>
                  ) : (
                    <span className={`chip chip--status-${it.status}`}>{STATUS_LABEL[it.status]}</span>
                  )}
                </button>
              );
            })}
            {participations.length === 0 && <p className="search-empty">Todavía no tiene clases.</p>}
          </div>
        </div>
      </div>

      {payOpen && <PaymentFormModal studentId={studentId} onClose={() => setPayOpen(false)} />}
      {packOpen && <PackFormModal studentId={studentId} onClose={() => setPackOpen(false)} />}
    </Modal>
  );
}

/** Muestra "YYYY-MM-DD" como "DD/MM". */
function formatBirthday(iso: string): string {
  const [, m, d] = iso.split('-');
  if (!m || !d) return iso;
  return `${d}/${m}`;
}
