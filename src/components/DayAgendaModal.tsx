import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { WEEKDAY_NAMES_LONG, CLASS_TYPE_LABEL } from '../lib/constants';
import { parseDayKey } from '../lib/date';
import { formatCurrency } from '../lib/format';
import { dayTotals, classStatus, shareBreakdown, STATUS_LABEL, classKey, studentDebt } from '../lib/money';
import { displayHoursForDay } from '../lib/schedule';
import { participantName, classNames, isBirthdayOn } from '../lib/students';
import { describeDiscount } from '../lib/discount';
import {
  classState,
  isChargeable,
  isHourBlocked,
  STATE_LABEL,
  stateMoneyNote,
} from '../lib/classMeta';
import { classRangeLabel, computeDayOverlaps, minutesToLabel } from '../lib/time';
import { isVirtual, slotsForDay } from '../lib/series';
import { holidayName } from '../lib/holidays';
import { useExitAnim } from '../hooks/useExitAnim';
import { useDialog } from '../state/DialogContext';
import { useDeleteClassFlow } from '../hooks/useDeleteClass';
import AttendanceToggle from './AttendanceToggle';
import PaymentToggle from './PaymentToggle';
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
  /** Convertir el turno en una serie recurrente (solo turnos que aún no son serie). */
  onRepeat: (start: number) => void;
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
  onRepeat,
  onBlockDay,
}: DayAgendaModalProps) {
  const {
    data,
    ledger,
    materializeIfVirtual,
    quickCollectClass,
    undoCollectClass,
    removeParticipant,
    setAttendance,
  } = useAgenda();
  const dialog = useDialog();
  const { isExiting, removeWithAnim } = useExitAnim();
  const date = parseDayKey(day);
  // Clases del día para mostrar: las reales MÁS las repeticiones de las series vivas que
  // todavía no vencieron. La clase real siempre gana sobre la virtual.
  const slots = slotsForDay(data, day);
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

  // Borrar un turno: flujo único compartido con la edición de la clase (ver useDeleteClassFlow).
  const confirmAndDelete = useDeleteClassFlow();

  const title = `${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

  /** Render de una clase cargada (a su hora real). */
  function renderClass(start: number, entry: ClassEntry) {
    const state = classState(entry);
    // Repetición futura de una serie viva: todavía no es una clase real. No se ofrece cobrar
    // ni marcar asistencia (la clase no pasó y no tiene plata propia todavía); apenas vence,
    // el roll-forward la convierte en clase real y vuelven a estar todas las acciones.
    const virtual = isVirtual(entry);
    const chargeable = isChargeable(entry) && !virtual;
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
          <span className={`badge badge--${entry.type}`}>{CLASS_TYPE_LABEL[entry.type]}</span>
          {state !== 'confirmada' && (
            <span className={`chip chip--state-${state}`}>
              {STATE_LABEL[state]}
              {moneyNote && <span className={`state-note state-note--${moneyNote.kind}`}> — {moneyNote.text}</span>}
            </span>
          )}
          {entry.seriesId && (
            <span className="serie-tag" title={virtual ? 'Turno fijo semanal: esta semana todavía no llegó' : 'Parte de una serie'}>
              {virtual ? 'fija' : 'serie'}
            </span>
          )}
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
            <button
              className="icon-btn has-tip"
              onClick={() => {
                materializeIfVirtual(day, start);
                onMoveClass(start);
              }}
              aria-label="Mover"
              data-tip="Mover"
            >
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
            {!entry.seriesId && (
              <button
                className="icon-btn has-tip"
                onClick={() => onRepeat(start)}
                aria-label="Repetir"
                data-tip="Repetir"
              >
                🔁
              </button>
            )}
            <button
              className="icon-btn has-tip"
              onClick={() => {
                // Editar una repetición virtual la vuelve una clase real (copy-on-write):
                // desde acá tiene su propia plata, asistencia y contenido.
                const real = materializeIfVirtual(day, start);
                onEditClass(start, real ?? entry);
              }}
              aria-label="Editar"
              data-tip="Editar"
            >
              ✎
            </button>
            <button
              className={`icon-btn has-tip${entry.reminder && !entry.reminder.done ? ' icon-btn--reminder' : ''}`}
              onClick={() => {
                materializeIfVirtual(day, start);
                onReminder(start);
              }}
              aria-label="Recordatorio"
              data-tip="Recordatorio"
            >
              🔔
            </button>
            <button
              className="btn btn--small day-slot__delete-btn"
              onClick={() => confirmAndDelete(day, start, entry)}
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
              const rowKey = `${start}-${idx}`;
              // Estado de cobro de ESTE alumno en ESTA clase, DERIVADO del ledger (una sola fuente
              // de verdad, la deuda de siempre): "pagado" = su parte ya está saldada. Acá NO se
              // recalcula ninguna plata: solo se lee para saber qué botón mostrar activo.
              const coveredByPack = Boolean(part?.coveredByPack);
              const paid = part?.status === 'pagada';
              const canToggle = Boolean(p.studentId) && Boolean(part) && !coveredByPack;
              // Deuda total del alumno (para tenerla presente al atenderlo) y cumple del día.
              const debt = p.studentId ? studentDebt(ledger, p.studentId) : { amount: 0, classes: 0 };
              const birthday = student ? isBirthdayOn(student, day) : false;
              return (
                <div key={idx} className={`student-line${isExiting(rowKey) ? ' is-exiting' : ''}`}>
                  <span className="student-line__name">{participantName(p, data.students)}</span>
                  {birthday && (
                    <span className="today-line__bday" title="¡Cumple años este día!">
                      🎂 ¡cumple!
                    </span>
                  )}
                  <span className="student-line__amount">{formatCurrency(bd.net)}</span>
                  {debt.amount > 0.5 && (
                    <span className="today-line__debt" title="Deuda total de este alumno">
                      debe{debt.classes > 0 ? ` ${debt.classes} ${debt.classes === 1 ? 'clase' : 'clases'} ·` : ''}{' '}
                      {formatCurrency(debt.amount)}
                    </span>
                  )}
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
                  {/* Botones "Pagado: Sí / No" por alumno (componente reutilizado en todas las
                      vistas donde se abre un turno). Maneja solo/pack/estado internamente. */}
                  <PaymentToggle day={day} start={start} studentId={p.studentId} />
                  {/* Pago con importe/medio/fecha a elección (parcial o distinto), si todavía debe. */}
                  {canToggle && !paid && (
                    <button
                      className="btn btn--tiny btn--ghost"
                      onClick={() => onRegisterPayment(p.studentId as string, { day, start })}
                    >
                      Otro monto…
                    </button>
                  )}
                  {/* Asistencia (vino / no vino). Solo registro: no toca la plata. */}
                  <AttendanceToggle attended={p.attended} onChange={(a) => setAttendance(day, start, idx, a)} />
                  <button
                    className="student-line__remove"
                    onClick={async () => {
                      const ok = await dialog.confirm(`¿Sacar a ${participantName(p, data.students)} de este turno?`, {
                        danger: true,
                        confirmLabel: 'Sacar',
                      });
                      if (ok) removeWithAnim(rowKey, () => removeParticipant(day, start, idx));
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
