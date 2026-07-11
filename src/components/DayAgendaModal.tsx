import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus, shareBreakdown, STATUS_LABEL, classKey } from '../lib/money';
import { displayHoursForDay } from '../lib/schedule';
import { participantName, classNames } from '../lib/students';
import { describeDiscount } from '../lib/discount';
import {
  classState,
  computeDayOverlaps,
  isChargeable,
  isHourBlocked,
  STATE_LABEL,
  stateMoneyNote,
  timeRange,
} from '../lib/classMeta';
import { holidayName } from '../lib/holidays';
import type { ClassEntry } from '../types';

interface DayAgendaModalProps {
  day: string;
  onClose: () => void;
  onNewClass: (hour: number) => void;
  onEditClass: (hour: number, entry: ClassEntry) => void;
  onRegisterPayment: (studentId: string, classRef: { day: string; hour: number }) => void;
  onMoveClass: (hour: number) => void;
  onDuplicateClass: (hour: number) => void;
  onBlockDay: () => void;
}

/** Panel con las 10 franjas horarias (7 a 16) de un día puntual. */
export default function DayAgendaModal({
  day,
  onClose,
  onNewClass,
  onEditClass,
  onRegisterPayment,
  onMoveClass,
  onDuplicateClass,
  onBlockDay,
}: DayAgendaModalProps) {
  const { data, ledger, deleteClass, deleteSeries, quickCollectClass, undoCollectClass, removeParticipant } = useAgenda();
  const date = parseDayKey(day);
  const slots = data.days[day];
  const totals = dayTotals(data, ledger, day);
  const block = data.blocks[day];
  const holiday = holidayName(day);
  // Franjas: horario configurado + cualquier hora con clase/bloqueo ese día.
  const hours = displayHoursForDay(data.settings, slots, block);
  // Horas cuyas clases se solapan con otra (aviso informativo, no bloquea nada).
  const overlaps = computeDayOverlaps(slots);

  function handleDelete(hour: number, entry: ClassEntry) {
    if (entry.seriesId) {
      if (confirm('Esta clase es parte de una serie. ¿Borrar TODA la serie?\n(Aceptar = toda la serie · Cancelar = seguir)')) {
        deleteSeries(entry.seriesId);
        return;
      }
    }
    if (confirm('¿Borrar este turno entero? Podés deshacerlo con el botón "Deshacer".')) deleteClass(day, hour);
  }

  const title = `${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="day-agenda__bar">
        {holiday && <span className="holiday-tag">🎉 Feriado: {holiday}</span>}
        {block?.fullDay && <span className="block-tag">🚫 Día bloqueado{block.reason ? `: ${block.reason}` : ''}</span>}
        <button className="btn btn--ghost btn--small" onClick={onBlockDay}>
          Bloquear / liberar
        </button>
      </div>

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
        {hours.map((hour) => {
          const entry = slots?.[String(hour)];
          const blocked = isHourBlocked(block, hour);

          if (!entry) {
            return (
              <div key={hour} className={`day-slot${blocked ? ' day-slot--blocked' : ''}`}>
                <span className="day-slot__hour">{hour}:00</span>
                {blocked ? (
                  <span className="day-slot__blocked-note">
                    🚫 Bloqueado{block?.reason ? ` · ${block.reason}` : ''}
                    <button className="btn btn--tiny btn--ghost" onClick={() => onNewClass(hour)}>
                      Cargar igual
                    </button>
                  </span>
                ) : (
                  <button className="day-slot__add" onClick={() => onNewClass(hour)}>
                    + Agregar clase
                  </button>
                )}
              </div>
            );
          }

          const state = classState(entry);
          const chargeable = isChargeable(entry);
          const status = classStatus(ledger, day, hour);
          const acc = ledger.byClass[classKey(day, hour)];
          const hasDiscount = acc ? acc.collected + acc.pending < entry.price - 0.5 : false;
          const moneyNote = stateMoneyNote(state);
          const overlapped = overlaps.has(hour);

          return (
            <div
              key={hour}
              className={`day-slot day-slot--filled day-slot--state-${state}${overlapped ? ' day-slot--overlap' : ''}`}
            >
              <div className="day-slot__head">
                <span className="day-slot__hour">{timeRange(hour, entry)}</span>
                {overlapped && (
                  <span className="overlap-tag" title="Esta clase se pisa en el horario con otra del día">
                    ⚠ se solapa
                  </span>
                )}
                <span className={`badge badge--${entry.type}`}>
                  {entry.type === 'grupal' ? 'Grupal' : 'Individual'}
                </span>
                {state !== 'confirmada' && (
                  <span className={`chip chip--state-${state}`}>
                    {STATE_LABEL[state]}
                    {moneyNote && <span className={`state-note state-note--${moneyNote.kind}`}> — {moneyNote.text}</span>}
                  </span>
                )}
                {entry.seriesId && <span className="serie-tag">serie</span>}
                <span className="day-slot__price">
                  {formatCurrency(entry.price)}
                  {hasDiscount && <span className="day-slot__discount-flag"> con desc.</span>}
                </span>
                {chargeable && <span className={`chip chip--status-${status}`}>{STATUS_LABEL[status]}</span>}
                <div className="day-slot__actions">
                  {chargeable && status !== 'pagada' && status !== 'sin-seguimiento' && (
                    <button className="btn btn--small btn--primary" onClick={() => quickCollectClass(day, hour)}>
                      Cobrar
                    </button>
                  )}
                  {chargeable && status === 'pagada' && (
                    <button className="btn btn--small btn--ghost" onClick={() => undoCollectClass(day, hour)}>
                      Deshacer
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => onMoveClass(hour)} aria-label="Mover" title="Mover">
                    ↦
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => onDuplicateClass(hour)}
                    aria-label="Duplicar"
                    title="Duplicar"
                  >
                    ⧉
                  </button>
                  <button className="icon-btn" onClick={() => onEditClass(hour, entry)} aria-label="Editar">
                    ✎
                  </button>
                  <button
                    className="btn btn--small day-slot__delete-btn"
                    onClick={() => handleDelete(hour, entry)}
                    aria-label="Borrar turno"
                    title="Borrar el turno entero (se puede deshacer)"
                  >
                    🗑 Borrar turno
                  </button>
                </div>
              </div>

              {chargeable ? (
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
                        <button
                          className="student-line__remove"
                          onClick={() => {
                            if (confirm(`¿Sacar a ${participantName(p, data.students)} de este turno?`))
                              removeParticipant(day, hour, idx);
                          }}
                          aria-label="Sacar del turno"
                          title="Sacar del turno"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="day-slot__students">
                  <span className="student-line__name">
                    {classNames(entry, data.students).join(', ')} · cancelada (no se cobra)
                  </span>
                </div>
              )}

              {/* Temas trabajados y adjuntos (contenido deportivo). */}
              {(entry.content?.length || entry.attachments?.length) && (
                <div className="day-slot__content">
                  {entry.content?.map((t) => (
                    <span key={t} className="topic-chip">
                      {t}
                    </span>
                  ))}
                  {entry.attachments?.length ? (
                    <span className="day-slot__attach-count">📎 {entry.attachments.length}</span>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
