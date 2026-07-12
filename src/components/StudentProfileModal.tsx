import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { WEEKDAY_NAMES } from '../lib/constants';
import { displayName, CATEGORY_LABELS, RANK_LABELS, whatsappLink } from '../lib/students';
import { minutesToLabel } from '../lib/time';
import { describeDiscount } from '../lib/discount';
import { STATUS_LABEL, studentPayments, studentPacks } from '../lib/money';
import { downloadReceipt } from '../lib/receipt';
import { newId } from '../lib/id';
import { useExitAnim } from '../hooks/useExitAnim';
import type { Attachment, Objective, ProgressNote, Student } from '../types';
import PaymentFormModal from './PaymentFormModal';
import PackFormModal from './PackFormModal';
import AttachmentsEditor from './AttachmentsEditor';

interface StudentProfileModalProps {
  studentId: string;
  onClose: () => void;
  onEdit: (student: Student) => void;
  onOpenDay: (day: string) => void;
}

/** Ficha completa del alumno: datos, saldo, packs, historial de clases y de pagos. */
export default function StudentProfileModal({ studentId, onClose, onEdit, onOpenDay }: StudentProfileModalProps) {
  const { data, ledger, setStudentActive, upsertStudent, deletePayment, deletePack } = useAgenda();
  const dialog = useDialog();
  const { isExiting, removeWithAnim } = useExitAnim();
  const student = data.students[studentId];
  const [payOpen, setPayOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [objText, setObjText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));

  if (!student) {
    onClose();
    return null;
  }

  // --- Contenido deportivo de la ficha (objetivos, notas de evolución, adjuntos) ---
  const objectives = student.objectives ?? [];
  const progressNotes = [...(student.progressNotes ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  function addObjective() {
    const text = objText.trim();
    if (!text) return;
    const obj: Objective = { id: newId(), text, status: 'progreso', createdAt: new Date().toISOString() };
    upsertStudent({ ...student, objectives: [...objectives, obj] });
    setObjText('');
  }
  function toggleObjective(id: string) {
    upsertStudent({
      ...student,
      objectives: objectives.map((o) =>
        o.id === id ? { ...o, status: o.status === 'cumplido' ? 'progreso' : 'cumplido' } : o
      ),
    });
  }
  function deleteObjective(id: string) {
    upsertStudent({ ...student, objectives: objectives.filter((o) => o.id !== id) });
  }
  function addProgressNote() {
    const text = noteText.trim();
    if (!text) return;
    const note: ProgressNote = { id: newId(), date: noteDate, text };
    upsertStudent({ ...student, progressNotes: [...(student.progressNotes ?? []), note] });
    setNoteText('');
  }
  function deleteProgressNote(id: string) {
    upsertStudent({ ...student, progressNotes: (student.progressNotes ?? []).filter((n) => n.id !== id) });
  }
  function setAttachments(next: Attachment[]) {
    upsertStudent({ ...student, attachments: next.length ? next : undefined });
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
            {student.category && <span className="badge badge--cat">Cat. {CATEGORY_LABELS[student.category]}</span>}
            {student.rank && <span className={`badge badge--rank-${student.rank}`}>Nivel {RANK_LABELS[student.rank]}</span>}
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
                  onClick={async () => {
                    if (await dialog.confirm('¿Borrar el pack y su pago de compra?', { danger: true, confirmLabel: 'Borrar' }))
                      deletePack(st.pack.id);
                  }}
                  aria-label="Borrar pack"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Objetivos con seguimiento */}
        <div className="profile__section">
          <span className="profile__section-title">Objetivos</span>
          <div className="objectives">
            {objectives.map((o) => (
              <div key={o.id} className={`objective objective--${o.status}`}>
                <button
                  type="button"
                  className="objective__check"
                  onClick={() => toggleObjective(o.id)}
                  title={o.status === 'cumplido' ? 'Cumplido' : 'En progreso'}
                >
                  {o.status === 'cumplido' ? '✓' : '○'}
                </button>
                <span className="objective__text">{o.text}</span>
                <span className={`chip chip--${o.status === 'cumplido' ? 'paid' : 'pending'} chip--mini`}>
                  {o.status === 'cumplido' ? 'Cumplido' : 'En progreso'}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => deleteObjective(o.id)}
                  aria-label="Quitar objetivo"
                >
                  ✕
                </button>
              </div>
            ))}
            {objectives.length === 0 && <p className="search-empty">Sin objetivos cargados.</p>}
          </div>
          <div className="tag-editor__input">
            <input
              type="text"
              value={objText}
              placeholder="Nuevo objetivo (ej: mejorar la bandeja)"
              onChange={(e) => setObjText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addObjective();
                }
              }}
            />
            <button type="button" className="btn btn--ghost btn--small" onClick={addObjective}>
              + Agregar
            </button>
          </div>
        </div>

        {/* Notas de evolución (línea de tiempo) */}
        <div className="profile__section">
          <span className="profile__section-title">Evolución</span>
          <div className="progress-notes">
            {progressNotes.map((n) => (
              <div key={n.id} className="progress-note">
                <span className="progress-note__date">{n.date.split('-').reverse().join('/')}</span>
                <span className="progress-note__text">{n.text}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => deleteProgressNote(n.id)}
                  aria-label="Quitar nota"
                >
                  ✕
                </button>
              </div>
            ))}
            {progressNotes.length === 0 && <p className="search-empty">Sin notas de evolución.</p>}
          </div>
          <div className="progress-note__form">
            <input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
            <input
              type="text"
              value={noteText}
              placeholder="Cómo viene, qué mejoró..."
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addProgressNote();
                }
              }}
            />
            <button type="button" className="btn btn--ghost btn--small" onClick={addProgressNote}>
              + Agregar
            </button>
          </div>
        </div>

        {/* Fotos y videos del alumno */}
        <div className="profile__section">
          <span className="profile__section-title">Fotos y videos</span>
          <AttachmentsEditor attachments={student.attachments} onChange={setAttachments} />
        </div>

        {/* Historial de pagos */}
        <div className="profile__history">
          <span className="profile__section-title">Pagos ({payments.length})</span>
          <div className="search-results">
            {payments.map((p) => (
              <div key={p.id} className={`payment-row${isExiting(p.id) ? ' is-exiting' : ''}`}>
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
                  onClick={async () => {
                    if (await dialog.confirm('¿Borrar este pago?', { danger: true, confirmLabel: 'Borrar' }))
                      removeWithAnim(p.id, () => deletePayment(p.id));
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
                  key={`${it.day}-${it.start}`}
                  className="search-result"
                  onClick={() => onOpenDay(it.day)}
                >
                  <span>
                    {WEEKDAY_NAMES[date.getDay()]} {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} ·{' '}
                    {minutesToLabel(it.start)}
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
