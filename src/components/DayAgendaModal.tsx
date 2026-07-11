import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { HOURS, WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus, shareBreakdown, STATUS_LABEL, classKey } from '../lib/money';
import { participantName } from '../lib/students';
import { describeDiscount } from '../lib/discount';
import type { ClassEntry } from '../types';

interface DayAgendaModalProps {
  day: string;
  onClose: () => void;
  onNewClass: (hour: number) => void;
  onEditClass: (hour: number, entry: ClassEntry) => void;
  /** Abrir el formulario de pago para un alumno, atado a esta clase. */
  onRegisterPayment: (studentId: string, classRef: { day: string; hour: number }) => void;
}

/** Panel con las 10 franjas horarias (7 a 16) de un día puntual. */
export default function DayAgendaModal({
  day,
  onClose,
  onNewClass,
  onEditClass,
  onRegisterPayment,
}: DayAgendaModalProps) {
  const { data, ledger, deleteClass, quickCollectClass, undoCollectClass } = useAgenda();
  const date = parseDayKey(day);
  const slots = data.days[day];
  const totals = dayTotals(data, ledger, day);

  function handleDelete(hour: number) {
    if (confirm('¿Borrar esta clase? No se puede deshacer.')) deleteClass(day, hour);
  }

  const title = `${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="day-agenda__totals">
        <span>
          Clases: <strong>{totals.classes}</strong>
        </span>
        <span>
          Alumnos: <strong>{totals.students}</strong>
        </span>
        <span className="text-paid">
          Cobrado: <strong>{formatCurrency(totals.collected)}</strong>
        </span>
        <span className="text-pending">
          Pendiente: <strong>{formatCurrency(totals.pending)}</strong>
        </span>
      </div>

      <div className="day-agenda__slots">
        {HOURS.map((hour) => {
          const entry = slots?.[String(hour)];
          if (!entry) {
            return (
              <div key={hour} className="day-slot">
                <span className="day-slot__hour">{hour}:00</span>
                <button className="day-slot__add" onClick={() => onNewClass(hour)}>
                  + Agregar clase
                </button>
              </div>
            );
          }

          const status = classStatus(ledger, day, hour);
          const acc = ledger.byClass[classKey(day, hour)];
          const hasDiscount = acc ? acc.collected + acc.pending < entry.price - 0.5 : false;

          return (
            <div key={hour} className="day-slot day-slot--filled">
              <div className="day-slot__head">
                <span className="day-slot__hour">{hour}:00</span>
                <span className={`badge badge--${entry.type}`}>
                  {entry.type === 'grupal' ? 'Grupal' : 'Individual'}
                </span>
                <span className="day-slot__price">
                  {formatCurrency(entry.price)}
                  {hasDiscount && <span className="day-slot__discount-flag"> con desc.</span>}
                </span>
                <span className={`chip chip--status-${status}`}>{STATUS_LABEL[status]}</span>
                <div className="day-slot__actions">
                  {status !== 'pagada' && status !== 'sin-seguimiento' && (
                    <button className="btn btn--small btn--primary" onClick={() => quickCollectClass(day, hour)}>
                      Cobrar
                    </button>
                  )}
                  {status === 'pagada' && (
                    <button className="btn btn--small btn--ghost" onClick={() => undoCollectClass(day, hour)}>
                      Deshacer
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => onEditClass(hour, entry)} aria-label="Editar">
                    ✎
                  </button>
                  <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(hour)} aria-label="Borrar">
                    🗑
                  </button>
                </div>
              </div>

              {/* Detalle por alumno: parte neta, descuentos y estado. */}
              <div className="day-slot__students">
                {entry.participants.map((p, idx) => {
                  const student = p.studentId ? data.students[p.studentId] : undefined;
                  const bd = shareBreakdown(entry, idx, student);
                  const part = p.studentId
                    ? ledger.byStudent[p.studentId]?.participations.find((pp) => pp.day === day && pp.hour === hour)
                    : undefined;
                  const pStatus = part?.status;
                  return (
                    <div key={idx} className="student-line">
                      <span className="student-line__name">{participantName(p, data.students)}</span>
                      <span className="student-line__amount">{formatCurrency(bd.net)}</span>
                      {bd.fixedDiscount && (
                        <span className="disc-tag disc-tag--fija" title="Descuento fijo de la ficha">
                          −{describeDiscount(bd.fixedDiscount)} ficha
                        </span>
                      )}
                      {bd.oneTimeDiscount && (
                        <span className="disc-tag disc-tag--puntual" title="Descuento puntual de esta clase">
                          −{describeDiscount(bd.oneTimeDiscount)} puntual
                        </span>
                      )}
                      {part?.coveredByPack && <span className="disc-tag disc-tag--pack">pack</span>}
                      {pStatus && !part?.coveredByPack && (
                        <span className={`chip chip--status-${pStatus} chip--mini`}>{STATUS_LABEL[pStatus]}</span>
                      )}
                      {p.studentId && pStatus !== 'pagada' && !part?.coveredByPack && (
                        <button
                          className="btn btn--tiny btn--ghost"
                          onClick={() => onRegisterPayment(p.studentId as string, { day, hour })}
                        >
                          Pago
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
