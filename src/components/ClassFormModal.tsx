import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES_LONG, DURATION_OPTIONS } from '../lib/constants';
import { suggestedPrice } from '../lib/pricing';
import { participantName } from '../lib/students';
import { classDuration, classState, STATE_LABEL, STATES } from '../lib/classMeta';
import type { RecurrenceInput } from '../lib/recurrence';
import type { ClassEntry, ClassFormTarget, ClassParticipant, ClassState, ClassType } from '../types';
import StudentPicker from './StudentPicker';
import DiscountEditor from './DiscountEditor';

interface ClassFormModalProps {
  target: ClassFormTarget;
  onClose: () => void;
}

function emptyParticipant(): ClassParticipant {
  return { studentId: null, name: '' };
}

function countFilled(list: ClassParticipant[]): number {
  return list.filter((p) => p.studentId || p.name.trim()).length;
}

/** Fecha ISO "YYYY-MM-DD" a N semanas de un dayKey. */
function isoWeeksAhead(startDay: string, weeks: number): string {
  const d = parseDayKey(startDay);
  d.setDate(d.getDate() + weeks * 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Alta y edición de una clase, con duración, estado y recurrencia. */
export default function ClassFormModal({ target, onClose }: ClassFormModalProps) {
  const { data, upsertClass, quickCollectClass, createSeries, updateSeries } = useAgenda();
  const { day, hour, entry } = target;

  const [type, setType] = useState<ClassType>(entry?.type ?? 'grupal');
  const [participants, setParticipants] = useState<ClassParticipant[]>(
    entry?.participants.length ? entry.participants : [emptyParticipant()]
  );
  const [priceTouched, setPriceTouched] = useState(Boolean(entry));
  const [price, setPrice] = useState<number>(entry?.price ?? suggestedPrice('grupal', 1, data.prices));
  const [duration, setDuration] = useState<number>(entry ? classDuration(entry) : 60);
  const [state, setState] = useState<ClassState>(entry ? classState(entry) : 'confirmada');
  const [collectNow, setCollectNow] = useState(false);
  const [showDiscounts, setShowDiscounts] = useState(Boolean(entry?.participants.some((p) => p.discount)));
  // Aplicar la edición a toda la serie (solo si la clase pertenece a una).
  const [applyToSeries, setApplyToSeries] = useState(false);

  // Recurrencia (solo al crear).
  const [repeat, setRepeat] = useState(false);
  const [everyWeeks, setEveryWeeks] = useState(1);
  const [endType, setEndType] = useState<'count' | 'date'>('count');
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState(() => isoWeeksAhead(day, 4));

  function recalcPrice(nextType: ClassType, nextList: ClassParticipant[]) {
    if (priceTouched) return;
    const c = nextType === 'grupal' ? Math.max(countFilled(nextList), 1) : 1;
    setPrice(suggestedPrice(nextType, c, data.prices));
  }
  function applyType(nextType: ClassType) {
    setType(nextType);
    const nextList = nextType === 'indiv' ? [participants[0] ?? emptyParticipant()] : participants;
    setParticipants(nextList);
    recalcPrice(nextType, nextList);
  }
  function updateParticipant(idx: number, p: ClassParticipant) {
    const next = participants.map((cur, i) => (i === idx ? p : cur));
    setParticipants(next);
    recalcPrice(type, next);
  }
  function addParticipant() {
    setParticipants([...participants, emptyParticipant()]);
  }
  function removeParticipant(idx: number) {
    const next = participants.filter((_, i) => i !== idx);
    const finalNext = next.length ? next : [emptyParticipant()];
    setParticipants(finalNext);
    recalcPrice(type, finalNext);
  }

  function handleSave() {
    const valid = participants.filter((p) => p.studentId || p.name.trim());
    if (valid.length === 0) {
      alert('Ingresá al menos un alumno.');
      return;
    }
    const finalList = (type === 'indiv' ? valid.slice(0, 1) : valid).map((p) => ({
      studentId: p.studentId,
      name: p.studentId ? participantName(p, data.students) : p.name.trim(),
      discount: p.discount,
    }));
    const finalEntry: ClassEntry = {
      type,
      participants: finalList,
      price: Number(price) || 0,
      // Solo se guardan si difieren del default (para no ensuciar clases v3).
      duration: duration !== 60 ? duration : undefined,
      state: state !== 'confirmada' ? state : undefined,
      seriesId: entry?.seriesId,
    };

    if (entry && entry.seriesId && applyToSeries) {
      // Propagar contenido a toda la serie (cada clase conserva su día/hora).
      updateSeries(entry.seriesId, {
        type,
        participants: finalList,
        price: finalEntry.price,
        duration: finalEntry.duration,
        state: finalEntry.state,
      });
      onClose();
      return;
    }

    if (!entry && repeat) {
      const recurrence: RecurrenceInput = {
        everyWeeks: Math.max(1, everyWeeks),
        end: endType === 'count' ? { type: 'count', count } : { type: 'date', date: endDate },
      };
      const res = createSeries(day, hour, finalEntry, recurrence);
      let msg = `Se crearon ${res.created} clases de la serie.`;
      if (res.skipped > 0) msg += ` Se omitieron ${res.skipped} (ya había clase en esa franja).`;
      alert(msg);
      onClose();
      return;
    }

    upsertClass(day, hour, finalEntry);
    if (collectNow && !entry) setTimeout(() => quickCollectClass(day, hour), 0);
    onClose();
  }

  const date = parseDayKey(day);
  const title = `${entry ? 'Editar' : 'Nueva'} clase · ${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${
    date.getMonth() + 1
  } · ${hour}:00`;
  const visible = type === 'indiv' ? participants.slice(0, 1) : participants;
  const chosenIds = participants.map((p) => p.studentId).filter((id): id is string => Boolean(id));

  return (
    <Modal title={title} onClose={onClose}>
      <div className="class-form">
        <div className="class-form__row">
          <label>Tipo de clase</label>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__option${type === 'grupal' ? ' segmented__option--active' : ''}`}
              onClick={() => applyType('grupal')}
            >
              Grupal
            </button>
            <button
              type="button"
              className={`segmented__option${type === 'indiv' ? ' segmented__option--active' : ''}`}
              onClick={() => applyType('indiv')}
            >
              Individual
            </button>
          </div>
        </div>

        <div className="class-form__row">
          <div className="class-form__label-row">
            <label>{type === 'grupal' ? 'Alumnos' : 'Alumno'}</label>
            <button type="button" className="link-btn" onClick={() => setShowDiscounts((v) => !v)}>
              {showDiscounts ? 'Ocultar descuentos' : 'Descuento puntual'}
            </button>
          </div>
          <div className="student-list">
            {visible.map((p, idx) => (
              <div key={idx} className="participant-block">
                <StudentPicker
                  participant={p}
                  excludeIds={chosenIds.filter((id) => id !== p.studentId)}
                  placeholder={`Alumno ${idx + 1}`}
                  onChange={(next) => updateParticipant(idx, next)}
                  onRemove={type === 'grupal' && participants.length > 1 ? () => removeParticipant(idx) : undefined}
                />
                {showDiscounts && (
                  <DiscountEditor
                    value={p.discount}
                    onChange={(d) => updateParticipant(idx, { ...p, discount: d })}
                    hint="solo esta clase"
                  />
                )}
              </div>
            ))}
            {type === 'grupal' && (
              <button type="button" className="btn btn--ghost btn--small" onClick={addParticipant}>
                + Agregar alumno
              </button>
            )}
          </div>
        </div>

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Importe</label>
            <input
              type="number"
              value={price}
              onChange={(e) => {
                setPriceTouched(true);
                setPrice(Number(e.target.value));
              }}
            />
          </div>
          <div>
            <label>Duración</label>
            <select className="select" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="class-form__row">
          <label>Estado</label>
          <select className="select" value={state} onChange={(e) => setState(e.target.value as ClassState)}>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </select>
          {state === 'cancelada' && (
            <span className="discount-editor__hint">Una clase cancelada no genera deuda ni cobro.</span>
          )}
        </div>

        {/* Recurrencia (solo al crear). */}
        {!entry && (
          <div className="class-form__row">
            <label className="checkbox-row">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              Repetir esta clase
            </label>
            {repeat && (
              <div className="recurrence">
                <div className="recurrence__row">
                  <span>Cada</span>
                  <input
                    type="number"
                    min={1}
                    value={everyWeeks}
                    onChange={(e) => setEveryWeeks(Number(e.target.value))}
                  />
                  <span>semana(s)</span>
                </div>
                <div className="recurrence__row">
                  <select className="select" value={endType} onChange={(e) => setEndType(e.target.value as 'count' | 'date')}>
                    <option value="count">Cantidad de clases</option>
                    <option value="date">Hasta una fecha</option>
                  </select>
                  {endType === 'count' ? (
                    <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} />
                  ) : (
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aplicar a la serie (solo al editar una clase de una serie). */}
        {entry && entry.seriesId && (
          <label className="checkbox-row">
            <input type="checkbox" checked={applyToSeries} onChange={(e) => setApplyToSeries(e.target.checked)} />
            Aplicar los cambios a toda la serie
          </label>
        )}

        {!entry && !repeat && (
          <label className="checkbox-row">
            <input type="checkbox" checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} />
            Cobrar ahora (con el medio por defecto)
          </label>
        )}

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
