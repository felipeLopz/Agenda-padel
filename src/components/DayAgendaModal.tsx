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
  isChargeable,
  isHourBlocked,
  STATE_LABEL,
  stateMoneyNote,
} from '../lib/classMeta';
import { classRangeLabel, computeDayOverlaps, minutesToLabel } from '../lib/time';
import { holidayName } from '../lib/holidays';
import { useExitAnim } from '../hooks/useExitAnim';
import type { ClassEntry } from '../types';

interface DayAgendaModalProps {
  day: string;
  onClose: () => void;
  /** Crear una clase nueva empezando en `start` (minutos). */
  onNewClass: (start: number) => void;
  onEditClass: (start: number, entry: ClassEntry) => void;
  onRegisterPayment: (studentId: string, classRef: { day: string; start: number }) => void;
  onMoveClass: (start: number) => void;
  onDuplicateClass: (start: number) => void;
  onReminder: (start: number) => void;
  onBlockDay: () => void;
}

/** Agenda de un día: las clases del día (a su hora real) más las horas libres del horario. */
export default function DayAgendaModal({
  day,
  onClose,
  onNewClass,
  onEditClass,
  onRegisterPayment,
  onMoveClass,
  onDuplicateClass,
  onReminder,
  onBlockDay,
}: DayAgendaModalProps) {
  const { data, ledger, deleteClass, deleteSeries, quickCollectClass, undoCollectClass, removeParticipant } = useAgenda();
  const { isExiting, removeWithAnim } = useExitAnim();
  const date = parseDayKey(day);
  const slots = data.days[day];
  const totals = dayTotals(data, ledger, day);
  const block = data.blocks[day];
  const holiday = holidayName(day);
  // Horas a mostrar: horario configurado + cualquier hora con clase/bloqueo ese día.
  const hours = displayHoursForDay(data.settings, slots, block);
  // Clases del día agrupadas por la HORA (bucket) en la que empiezan; ordenadas por inicio.
  const classesByHour = new Map<number, Array<{ start: number; entry: ClassEntry }>>();
  for (const [startStr, entry] of Object.entries(slots ?? {})) {
    const start = Number(startStr);
    const h = Math.floor(start / 60);
    const list = classesByHour.get(h) ?? [];
    list.push({ start, entry });
    classesByHour.set(h, list);
  }
  for (const list of classesByHour.values()) list.sort((a, b) => a.start - b.start);
  // Inicios cuyas clases se solapan con otra (marca informativa; puede venir de datos viejos).
  const overlaps = computeDayOverlaps(slots);

  function handleDelete(start: number, entry: ClassEntry) {
    if (entry.seriesId) {
      if (confirm('Esta clase es parte de una serie. ¿Borrar TODA la serie?\n(Aceptar = toda la serie · Cancelar = seguir)')) {
        deleteSeries(entry.seriesId);
        return;
      }
    }
    if (confirm('¿Borrar este turno entero? Podés deshacerlo con el botón "Deshacer".')) deleteClass(day, start);
  }

  const title = `${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

  /** Render de una clase cargada (a su hora real). */
  function renderClass(start: number, entry: ClassEntry) {
    const state = classState(entry);
    const chargeable = isChargeable(entry);
    const status = classStatus(ledger, day, start);
    const acc = ledger.byClass[classKey(day, start)];
    const hasDiscount = acc ? acc.collected + acc.pending < entry.price - 0.5 : false;
    const moneyNote = stateMoneyNote(state);
    const overlapped = overlaps.has(start);

    return (
      <div
        key={start}
        className={`day-slot day-slot--filled day-slot--state-${state}${overlapped ? ' day-slot--overlap' : ''}`}
      >
        <div className="day-slot__head">
          <span className="day-slot__hour">{classRangeLabel(start, entry)}</span>
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
              <button className="btn btn--small btn--primary" onClick={() => quickCollectClass(day, start)}>
                Cobrar
              </button>
            )}
            {chargeable && status === 'pagada' && (
              <button className="btn btn--small btn--ghost" onClick={() => undoCollectClass(day, start)}>
                Deshacer
              </button>
            )}
            <button className="icon-btn has-tip" onClick={() => onMoveClass(start)} aria-label="Mover" data-tip="Mover">
              ↦
            </button>
            <button
              className="icon-btn has-tip"
              onClick={() => onDuplicateClass(start)}
              aria-label="Duplicar"
              data-tip="Duplicar"
            >
              ⧉
            </button>
            <button className="icon-btn has-tip" onClick={() => onEditClass(start, entry)} aria-label="Editar" data-tip="Editar">
              ✎
            </button>
            <button
              className={`icon-btn has-tip${entry.reminder && !entry.reminder.done ? ' icon-btn--reminder' : ''}`}
              onClick={() => onReminder(start)}
              aria-label="Recordatorio"
              data-tip="Recordatorio"
            >
              🔔
            </button>
            <button
              className="btn btn--small day-slot__delete-btn"
              onClick={() => handleDelete(start, entry)}
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
                ? ledger.byStudent[p.studentId]?.participations.find((pp) => pp.day === day && pp.start === start)
                : undefined;
              const pStatus = part?.status;
              const rowKey = `${start}-${idx}`;
              return (
                <div key={idx} className={`student-line${isExiting(rowKey) ? ' is-exiting' : ''}`}>
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
                      onClick={() => onRegisterPayment(p.studentId as string, { day, start })}
                    >
                      Pago
                    </button>
                  )}
                  <button
                    className="student-line__remove"
                    onClick={() => {
                      if (confirm(`¿Sacar a ${participantName(p, data.students)} de este turno?`))
                        removeWithAnim(rowKey, () => removeParticipant(day, start, idx));
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

        {/* Recordatorio del turno (si tiene uno activo). */}
        {entry.reminder && !entry.reminder.done && (
          <div className="day-slot__reminder">🔔 {entry.reminder.text}</div>
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
  }

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
          const items = classesByHour.get(hour) ?? [];
          const blocked = isHourBlocked(block, hour);

          // Hora con clase(s): se muestran a su horario real.
          if (items.length > 0) {
            return items.map(({ start, entry }) => renderClass(start, entry));
          }

          // Hora libre: botón para agregar (empieza en punto; el horario exacto se ajusta en el form).
          return (
            <div key={`empty-${hour}`} className={`day-slot${blocked ? ' day-slot--blocked' : ''}`}>
              <span className="day-slot__hour">{minutesToLabel(hour * 60)}</span>
              {blocked ? (
                <span className="day-slot__blocked-note">
                  🚫 Bloqueado{block?.reason ? ` · ${block.reason}` : ''}
                  <button className="btn btn--tiny btn--ghost" onClick={() => onNewClass(hour * 60)}>
                    Cargar igual
                  </button>
                </span>
              ) : (
                <button className="day-slot__add" onClick={() => onNewClass(hour * 60)}>
                  + Agregar clase
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
