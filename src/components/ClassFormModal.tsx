import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES_LONG, DURATION_OPTIONS, COMMON_TOPICS } from '../lib/constants';
import { suggestedPrice } from '../lib/pricing';
import { participantName } from '../lib/students';
import { formatCurrency } from '../lib/format';
import { classDuration, classState, findOverlapFor, STATE_LABEL, STATES, timeRange } from '../lib/classMeta';
import type { RecurrenceInput } from '../lib/recurrence';
import type { Attachment, ClassEntry, ClassFormTarget, ClassParticipant, ClassState, ClassType } from '../types';
import StudentPicker from './StudentPicker';
import DiscountEditor from './DiscountEditor';
import AttachmentsEditor from './AttachmentsEditor';
import NumberInput from './NumberInput';

interface ClassFormModalProps {
  target: ClassFormTarget;
  onClose: () => void;
  /** Abre el editor de recordatorio de este turno (solo tiene sentido al editar). */
  onReminder: () => void;
}

function emptyParticipant(): ClassParticipant {
  return { studentId: null, name: '' };
}

/** Fecha ISO "YYYY-MM-DD" a N semanas de un dayKey. */
function isoWeeksAhead(startDay: string, weeks: number): string {
  const d = parseDayKey(startDay);
  d.setDate(d.getDate() + weeks * 7);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Alta y edición de una clase, con duración, estado y recurrencia. */
export default function ClassFormModal({ target, onClose, onReminder }: ClassFormModalProps) {
  const { data, upsertClass, deleteClass, quickCollectClass, createSeries, updateSeries } = useAgenda();
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
  // Contenido deportivo (temas trabajados) y adjuntos de la clase.
  const [content, setContent] = useState<string[]>(entry?.content ?? []);
  const [topicInput, setTopicInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>(entry?.attachments ?? []);
  // Aplicar la edición a toda la serie (solo si la clase pertenece a una).
  const [applyToSeries, setApplyToSeries] = useState(false);

  // Recurrencia (solo al crear).
  const [repeat, setRepeat] = useState(false);
  const [everyWeeks, setEveryWeeks] = useState(1);
  const [endType, setEndType] = useState<'count' | 'date'>('count');
  const [count, setCount] = useState(4);
  const [endDate, setEndDate] = useState(() => isoWeeksAhead(day, 4));

  // El importe individual se autosugiere (si no lo tocaste). En grupal el total sale de
  // la SUMA de los precios por alumno (v8), así que no hay un total a autocalcular acá.
  function suggestIndivPrice(nextType: ClassType) {
    if (priceTouched || nextType !== 'indiv') return;
    setPrice(suggestedPrice('indiv', 1, data.prices));
  }
  function applyType(nextType: ClassType) {
    setType(nextType);
    const nextList = nextType === 'indiv' ? [participants[0] ?? emptyParticipant()] : participants;
    setParticipants(nextList);
    suggestIndivPrice(nextType);
  }
  function updateParticipant(idx: number, p: ClassParticipant) {
    setParticipants(participants.map((cur, i) => (i === idx ? p : cur)));
  }
  function addParticipant() {
    // Cada alumno arranca con el precio grupal sugerido (editable por alumno).
    setParticipants([...participants, { studentId: null, name: '', price: data.prices.grupal }]);
  }
  function removeParticipant(idx: number) {
    const next = participants.filter((_, i) => i !== idx);
    if (next.length === 0) {
      // Quedó sin nadie: si es una clase existente, se borra el turno (deshacible) y se
      // cierra; si es una clase nueva, se deja una fila en blanco para cargar a alguien.
      if (entry) {
        deleteClass(day, hour);
        onClose();
        return;
      }
      setParticipants([emptyParticipant()]);
      return;
    }
    setParticipants(next);
  }

  function addTopic(text: string) {
    const t = text.trim();
    if (!t) return;
    // Dedup sin distinguir mayúsculas.
    if (!content.some((c) => c.toLowerCase() === t.toLowerCase())) setContent([...content, t]);
    setTopicInput('');
  }
  function removeTopic(topic: string) {
    setContent(content.filter((c) => c !== topic));
  }

  function handleSave() {
    const valid = participants.filter((p) => p.studentId || p.name.trim());
    if (valid.length === 0) {
      // Clase existente que quedó sin alumnos → se borra el turno (deshacible), sin trabar.
      if (entry) {
        deleteClass(day, hour);
        onClose();
        return;
      }
      alert('Ingresá al menos un alumno.');
      return;
    }

    // Aviso blando de solapamiento: si la clase (por su duración) se pisa con otra
    // del mismo día, avisamos pero dejamos guardar igual. Las canceladas no cuentan.
    if (state !== 'cancelada') {
      const conflictHour = findOverlapFor(data.days[day], hour, duration);
      if (conflictHour != null) {
        const other = data.days[day]?.[String(conflictHour)];
        const otherRange = other ? timeRange(conflictHour, other) : `${conflictHour}:00`;
        const ok = confirm(
          `⚠ Esta clase se solapa en el horario con la de las ${otherRange}. ¿Guardar igual?`
        );
        if (!ok) return;
      }
    }
    const finalList = (type === 'indiv' ? valid.slice(0, 1) : valid).map((p) => ({
      studentId: p.studentId,
      name: p.studentId ? participantName(p, data.students) : p.name.trim(),
      discount: p.discount,
      // Grupal: cada alumno guarda su precio propio. Individual: sin precio por alumno.
      price: type === 'grupal' ? (p.price ?? data.prices.grupal) : undefined,
    }));
    // El total de la clase es la suma de los alumnos (grupal) o el importe único (indiv).
    const totalPrice =
      type === 'grupal' ? finalList.reduce((sum, p) => sum + (p.price ?? 0), 0) : Number(price) || 0;
    const finalEntry: ClassEntry = {
      type,
      participants: finalList,
      price: totalPrice,
      // Solo se guardan si difieren del default (para no ensuciar clases v3).
      duration: duration !== 60 ? duration : undefined,
      state: state !== 'confirmada' ? state : undefined,
      seriesId: entry?.seriesId,
      content: content.length ? content : undefined,
      attachments: attachments.length ? attachments : undefined,
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
  // Total de la clase grupal = suma de los precios de los alumnos cargados.
  const grupalTotal = visible
    .filter((p) => p.studentId || p.name.trim())
    .reduce((sum, p) => sum + (p.price ?? data.prices.grupal), 0);

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
                  onRemove={type === 'grupal' ? () => removeParticipant(idx) : undefined}
                />
                {type === 'grupal' && (
                  <div className="participant-block__price">
                    <label>Precio de este alumno</label>
                    <NumberInput
                      value={p.price ?? data.prices.grupal}
                      onChange={(n) => updateParticipant(idx, { ...p, price: n })}
                    />
                  </div>
                )}
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
            {type === 'indiv' ? (
              <>
                <label>Importe</label>
                <NumberInput
                  value={price}
                  onChange={(n) => {
                    setPriceTouched(true);
                    setPrice(n);
                  }}
                />
              </>
            ) : (
              <>
                <label>Total de la clase (suma de los alumnos)</label>
                <div className="class-form__total">{formatCurrency(grupalTotal)}</div>
              </>
            )}
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
          {state === 'ausente' && (
            <span className="discount-editor__hint">El alumno no vino, pero la clase se cobra igual.</span>
          )}
        </div>

        {/* Contenido de la clase: temas trabajados (chips con sugerencias). */}
        <div className="class-form__row">
          <label>Contenido de la clase (temas)</label>
          {content.length > 0 && (
            <div className="tag-editor__chips">
              {content.map((t) => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" onClick={() => removeTopic(t)} aria-label={`Quitar ${t}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="tag-editor__input">
            <input
              type="text"
              list="topic-suggestions"
              value={topicInput}
              placeholder="Ej: saque, bandeja, víbora..."
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTopic(topicInput);
                }
              }}
            />
            <datalist id="topic-suggestions">
              {COMMON_TOPICS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => addTopic(topicInput)}>
              + Agregar
            </button>
          </div>
        </div>

        {/* Adjuntos: fotos comprimidas + enlaces de video. */}
        <div className="class-form__row">
          <label>Fotos y videos de la clase</label>
          <AttachmentsEditor attachments={attachments} onChange={setAttachments} />
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
                  <NumberInput min={1} value={everyWeeks} onChange={setEveryWeeks} />
                  <span>semana(s)</span>
                </div>
                <div className="recurrence__row">
                  <select className="select" value={endType} onChange={(e) => setEndType(e.target.value as 'count' | 'date')}>
                    <option value="count">Cantidad de clases</option>
                    <option value="date">Hasta una fecha</option>
                  </select>
                  {endType === 'count' ? (
                    <NumberInput min={1} value={count} onChange={setCount} />
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

        {entry && (
          <div className="class-form__row">
            <button type="button" className="btn btn--ghost" onClick={onReminder}>
              🔔 {entry.reminder ? 'Editar recordatorio' : 'Agregar recordatorio'}
            </button>
          </div>
        )}

        <div className="class-form__actions">
          {entry && (
            <button
              type="button"
              className="btn btn--small day-slot__delete-btn class-form__delete"
              onClick={() => {
                if (confirm('¿Borrar este turno entero? Podés deshacerlo con "Deshacer".')) {
                  deleteClass(day, hour);
                  onClose();
                }
              }}
            >
              🗑 Borrar turno
            </button>
          )}
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
