import { useMemo, useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES_LONG, DURATION_OPTIONS, COMMON_TOPICS } from '../lib/constants';
import { suggestedPrice, frequentAmounts, defaultStudentPrice } from '../lib/pricing';
import { previousClass } from '../lib/schedule';
import { participantName } from '../lib/students';
import { formatCurrency } from '../lib/format';
import { classDuration, classState, STATE_LABEL, STATES } from '../lib/classMeta';
import { findOverlapStart, minutesToLabel, nextFreeStart } from '../lib/time';
import type { Attachment, ClassEntry, ClassFormTarget, ClassParticipant, ClassState, ClassType } from '../types';
import StudentPicker from './StudentPicker';
import DiscountEditor from './DiscountEditor';
import AttachmentsEditor from './AttachmentsEditor';
import NumberInput from './NumberInput';
import AmountButtons from './AmountButtons';
import TimeField from './TimeField';
import PaymentToggle from './PaymentToggle';

/** Campos que se pueden prellenar desde el turno anterior o desde una plantilla. */
interface PrefillSource {
  type: ClassType;
  participants: ClassParticipant[];
  price: number;
  duration?: number;
  content?: string[];
}

interface ClassFormModalProps {
  target: ClassFormTarget;
  onClose: () => void;
  /** Abre el editor de recordatorio de este turno (solo tiene sentido al editar). */
  onReminder: () => void;
  /** Abre "Repetir turno" para convertir esta clase existente en una serie (solo al editar). */
  onRepeat: () => void;
}

function emptyParticipant(): ClassParticipant {
  return { studentId: null, name: '' };
}

/** Alta y edición de una clase, con duración, estado y turno fijo semanal. */
export default function ClassFormModal({ target, onClose, onReminder, onRepeat }: ClassFormModalProps) {
  const { data, upsertClass, relocateClass, deleteClass, quickCollectClass, makeSeriesLive, updateSeries, saveTemplate, deleteTemplate } =
    useAgenda();
  const dialog = useDialog();
  // `initialStart` es la franja actual de la clase (su clave); `start` es la elegida en el form.
  const { day, start: initialStart, entry } = target;

  const [start, setStart] = useState<number>(initialStart);
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

  // Turno fijo semanal (solo al crear): se guarda como serie viva, sin fecha de fin.
  const [repeat, setRepeat] = useState(false);

  // Guardar el turno como plantilla (nombre + toggle).
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // Atajos de carga veloz: el turno anterior (para "igual que el anterior") y los montos
  // frecuentes (botones de precio). Solo LEEN datos, no cambian ningún cálculo.
  const previous = useMemo(() => (entry ? undefined : previousClass(data, day, initialStart)), [entry, data.days, day, initialStart]);
  const freqAmounts = useMemo(() => frequentAmounts(data), [data.payments, data.prices]);
  const templates = Object.values(data.templates);

  /** Prellena el formulario desde el turno anterior o una plantilla (alumnos, precios, etc.). */
  function prefillFrom(src: PrefillSource) {
    setType(src.type);
    // Copia los alumnos SIN la asistencia (es de esa fecha) y con sus precios/descuentos.
    setParticipants(
      src.participants.length
        ? src.participants.map((p) => ({ studentId: p.studentId, name: p.name, price: p.price, discount: p.discount }))
        : [emptyParticipant()]
    );
    setPrice(src.price);
    setPriceTouched(true); // ya viene un precio: no autosugerir
    setDuration(src.duration ?? 60);
    setContent(src.content ?? []);
    setShowDiscounts(src.participants.some((p) => p.discount));
  }

  /** Agrega o quita un tema de contenido con un toque (chips de temas de pádel). */
  function toggleTopic(t: string) {
    const exists = content.some((c) => c.toLowerCase() === t.toLowerCase());
    setContent(exists ? content.filter((c) => c.toLowerCase() !== t.toLowerCase()) : [...content, t]);
  }

  function handleSaveTemplate() {
    const name = templateName.trim();
    if (!name) {
      void dialog.alert('Poné un nombre para la plantilla.');
      return;
    }
    const valid = participants.filter((p) => p.studentId || p.name.trim());
    if (valid.length === 0) {
      void dialog.alert('Cargá al menos un alumno para guardar la plantilla.');
      return;
    }
    const tParticipants = (type === 'indiv' ? valid.slice(0, 1) : type === 'doble' ? valid.slice(0, 2) : valid).map(
      (p) => ({
        studentId: p.studentId,
        name: p.studentId ? participantName(p, data.students) : p.name.trim(),
        discount: p.discount,
        // Grupal y Doble: precio propio por alumno. Individual: sin precio por alumno.
        price: type === 'indiv' ? undefined : (p.price ?? defaultStudentPrice(type, data.prices)),
      })
    );
    const tPrice = type === 'indiv' ? Number(price) || 0 : tParticipants.reduce((sum, p) => sum + (p.price ?? 0), 0);
    saveTemplate({
      name,
      type,
      participants: tParticipants,
      price: tPrice,
      duration: duration !== 60 ? duration : undefined,
      content: content.length ? content : undefined,
    });
    setTemplateName('');
    setShowSaveTemplate(false);
    void dialog.alert(`Plantilla «${name}» guardada.`);
  }

  // El importe individual se autosugiere (si no lo tocaste). En grupal el total sale de
  // la SUMA de los precios por alumno (v8), así que no hay un total a autocalcular acá.
  function suggestIndivPrice(nextType: ClassType) {
    if (priceTouched || nextType !== 'indiv') return;
    setPrice(suggestedPrice('indiv', 1, data.prices));
  }
  async function applyType(nextType: ClassType) {
    if (nextType === type) return;
    if (nextType === 'doble') {
      // Doble = EXACTAMENTE 2 alumnos. Si ya hay más de 2 cargados, se avisa antes de recortar
      // (no se pierde ninguna ficha; solo se quitan de este formulario). Si cancela, no cambia.
      const withData = participants.filter((p) => p.studentId || p.name.trim());
      if (withData.length > 2) {
        const ok = await dialog.confirm(
          'La clase Doble es de exactamente 2 alumnos. ¿Dejar los primeros 2? Los demás solo se quitan de este formulario (no se borra ninguna ficha).',
          { confirmLabel: 'Dejar 2', cancelLabel: 'No cambiar' }
        );
        if (!ok) return;
      }
      const kept = participants.slice(0, 2);
      while (kept.length < 2) kept.push({ studentId: null, name: '', price: data.prices.doble });
      setParticipants(kept);
      setType('doble');
      return;
    }
    if (nextType === 'indiv') {
      setParticipants([participants[0] ?? emptyParticipant()]);
      setType('indiv');
      suggestIndivPrice('indiv');
      return;
    }
    // Grupal: se conservan todos los alumnos que haya.
    setType('grupal');
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
        deleteClass(day, initialStart);
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
        deleteClass(day, initialStart);
        onClose();
        return;
      }
      void dialog.alert('Ingresá al menos un alumno.');
      return;
    }

    // Doble = exactamente 2 alumnos: no se guarda con menos.
    if (type === 'doble' && valid.length < 2) {
      void dialog.alert('La clase Doble necesita 2 alumnos. Cargá el segundo, o cambiá a Individual o Grupal.');
      return;
    }

    // Solapamiento DURO: si la clase (por su duración) se pisa con otra del mismo día, NO
    // se permite guardar. Se sugiere el próximo horario libre. Las canceladas no ocupan
    // horario, así que no chequean. Al editar, se excluye su propia franja actual.
    if (state !== 'cancelada') {
      const excludeStart = entry ? initialStart : undefined;
      const conflictStart = findOverlapStart(data.days[day], start, duration, excludeStart);
      if (conflictStart != null) {
        const other = data.days[day]?.[String(conflictStart)];
        const otherRange = other
          ? `${minutesToLabel(conflictStart)}–${minutesToLabel(conflictStart + classDuration(other))}`
          : minutesToLabel(conflictStart);
        const suggestion = nextFreeStart(data.days[day], start, duration, excludeStart);
        void dialog.alert(
          `No se puede: esta clase se solapa con la de las ${otherRange}.` +
            (suggestion != null
              ? ` Probá desde las ${minutesToLabel(suggestion)}.`
              : ' No hay un hueco libre suficiente ese día.')
        );
        return;
      }
    }
    const finalList = (type === 'indiv' ? valid.slice(0, 1) : type === 'doble' ? valid.slice(0, 2) : valid).map((p) => ({
      studentId: p.studentId,
      name: p.studentId ? participantName(p, data.students) : p.name.trim(),
      discount: p.discount,
      // Grupal y Doble: cada alumno guarda su precio propio. Individual: sin precio por alumno.
      price: type === 'indiv' ? undefined : (p.price ?? defaultStudentPrice(type, data.prices)),
    }));
    // El total de la clase es la suma de los alumnos (grupal/doble) o el importe único (indiv).
    const totalPrice =
      type === 'indiv' ? Number(price) || 0 : finalList.reduce((sum, p) => sum + (p.price ?? 0), 0);
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
      // Propagar contenido a toda la serie (cada clase conserva su día y su hora de inicio;
      // el cambio de hora de ESTA clase no se propaga a la serie, para no pisar horarios).
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
      // Turno fijo semanal (serie viva): se guarda ESTA clase y se arma la regla a partir de
      // ella. No se generan clases por adelantado: las repeticiones aparecen solas en la
      // agenda y las que van venciendo se vuelven clases reales.
      upsertClass(day, start, finalEntry);
      // En el siguiente tick la clase ya está guardada, así que la regla se arma sobre ella.
      setTimeout(() => makeSeriesLive(day, start), 0);
      void dialog.alert(
        `Listo: este turno queda fijo todos los ${WEEKDAY_NAMES_LONG[parseDayKey(day).getDay()].toLowerCase()} ` +
          'a la misma hora, sin fecha de fin. Para cortarlo, usá ✂ "Terminar serie".'
      );
      onClose();
      return;
    }

    if (entry) {
      // Editar: si cambió la hora, se reubica la clase re-apuntando sus pagos (no se pierde
      // plata); si no cambió, es un simple upsert. `relocateClass` cubre ambos casos.
      relocateClass(day, initialStart, start, finalEntry);
    } else {
      upsertClass(day, start, finalEntry);
      if (collectNow) setTimeout(() => quickCollectClass(day, start), 0);
    }
    onClose();
  }

  const date = parseDayKey(day);
  const title = `${entry ? 'Editar' : 'Nueva'} clase · ${WEEKDAY_NAMES_LONG[date.getDay()]} ${date.getDate()}/${
    date.getMonth() + 1
  } · ${minutesToLabel(start)}`;
  // Individual = 1 lugar; Doble = 2 lugares fijos; Grupal = los que haya.
  const visible = type === 'indiv' ? participants.slice(0, 1) : type === 'doble' ? participants.slice(0, 2) : participants;
  const chosenIds = participants.map((p) => p.studentId).filter((id): id is string => Boolean(id));
  // Grupal y Doble tienen precio por alumno; el total es la suma de los alumnos cargados.
  const perStudentType = type === 'grupal' || type === 'doble';
  const defStudentPrice = defaultStudentPrice(type, data.prices);
  const perStudentTotal = visible
    .filter((p) => p.studentId || p.name.trim())
    .reduce((sum, p) => sum + (p.price ?? defStudentPrice), 0);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="class-form">
        {/* Carga veloz (solo al crear): copiar el turno anterior o una plantilla guardada. */}
        {!entry && (previous || templates.length > 0) && (
          <div className="class-form__row quick-fill-row">
            {previous && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => prefillFrom(previous.entry)}>
                ↺ Igual que el anterior
              </button>
            )}
            {templates.map((t) => (
              <span key={t.id} className="template-chip">
                <button type="button" className="template-chip__apply" onClick={() => prefillFrom(t)}>
                  📋 {t.name}
                </button>
                <button
                  type="button"
                  className="template-chip__del"
                  aria-label={`Borrar plantilla ${t.name}`}
                  onClick={async () => {
                    if (await dialog.confirm(`¿Borrar la plantilla «${t.name}»?`, { danger: true, confirmLabel: 'Borrar' }))
                      deleteTemplate(t.id);
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="class-form__row">
          <label>Tipo de clase</label>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__option${type === 'indiv' ? ' segmented__option--active' : ''}`}
              onClick={() => applyType('indiv')}
            >
              Individual
            </button>
            <button
              type="button"
              className={`segmented__option${type === 'doble' ? ' segmented__option--active' : ''}`}
              onClick={() => applyType('doble')}
            >
              Doble
            </button>
            <button
              type="button"
              className={`segmented__option${type === 'grupal' ? ' segmented__option--active' : ''}`}
              onClick={() => applyType('grupal')}
            >
              Grupal
            </button>
          </div>
          {type === 'doble' && (
            <span className="discount-editor__hint">La clase Doble es de exactamente 2 alumnos.</span>
          )}
        </div>

        <div className="class-form__row">
          <div className="class-form__label-row">
            <label>{type === 'indiv' ? 'Alumno' : 'Alumnos'}</label>
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
                {perStudentType && (
                  <div className="participant-block__price">
                    <label>Precio de este alumno</label>
                    <NumberInput
                      value={p.price ?? defStudentPrice}
                      onChange={(n) => updateParticipant(idx, { ...p, price: n })}
                    />
                    <AmountButtons amounts={freqAmounts} onPick={(n) => updateParticipant(idx, { ...p, price: n })} />
                  </div>
                )}
                {showDiscounts && (
                  <DiscountEditor
                    value={p.discount}
                    onChange={(d) => updateParticipant(idx, { ...p, discount: d })}
                    hint="solo esta clase"
                  />
                )}
                {/* Cobro por alumno: "Pagado: Sí / No" (solo en turnos ya guardados). Mismo
                    componente y misma plata que en Hoy y en la agenda del día. */}
                {entry && p.studentId && (
                  <div className="participant-block__pay">
                    <span className="participant-block__pay-label">¿Pagó?</span>
                    <PaymentToggle day={day} start={initialStart} studentId={p.studentId} />
                  </div>
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
            <label>Hora de inicio</label>
            <TimeField value={start} onChange={setStart} />
          </div>
          <div>
            <label>Duración</label>
            <div className="quick-dur">
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`quick-dur__btn${duration === d ? ' quick-dur__btn--on' : ''}`}
                  onClick={() => setDuration(d)}
                >
                  {d}′
                </button>
              ))}
              <select
                className="select quick-dur__select"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Otra duración"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="class-form__row">
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
              <AmountButtons
                amounts={freqAmounts}
                onPick={(n) => {
                  setPriceTouched(true);
                  setPrice(n);
                }}
              />
            </>
          ) : (
            <>
              <label>Total de la clase (suma de los alumnos)</label>
              <div className="class-form__total">{formatCurrency(perStudentTotal)}</div>
            </>
          )}
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
          {/* Temas de pádel de un toque: se agregan/quitan sin escribir. */}
          <div className="topic-suggest">
            {COMMON_TOPICS.map((t) => {
              const on = content.some((c) => c.toLowerCase() === t.toLowerCase());
              return (
                <button
                  key={t}
                  type="button"
                  className={`topic-suggest__btn${on ? ' topic-suggest__btn--on' : ''}`}
                  onClick={() => toggleTopic(t)}
                >
                  {on ? '✓ ' : '+ '}
                  {t}
                </button>
              );
            })}
          </div>
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

        {/* Turno fijo semanal (solo al crear): serie viva, sin fecha de fin. */}
        {!entry && (
          <div className="class-form__row">
            <label className="checkbox-row">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              Turno fijo: se repite todas las semanas
            </label>
            {repeat && (
              <span className="discount-editor__hint">
                Se repite todos los {WEEKDAY_NAMES_LONG[parseDayKey(day).getDay()].toLowerCase()} a la misma hora,
                sin fecha de fin. Cada semana es una clase aparte (su plata y su asistencia son independientes).
                Para cortarlo, después usás ✂ «Terminar serie» y elegís desde qué fecha.
              </span>
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
          <div className="class-form__row class-form__row--buttons">
            <button type="button" className="btn btn--ghost" onClick={onReminder}>
              🔔 {entry.reminder ? 'Editar recordatorio' : 'Agregar recordatorio'}
            </button>
            {/* Convertir este turno en serie recurrente. Solo si todavía no es parte de una. */}
            {!entry.seriesId && (
              <button type="button" className="btn btn--ghost" onClick={onRepeat}>
                🔁 Repetir este turno
              </button>
            )}
          </div>
        )}

        {/* Guardar este turno como plantilla reusable (ej: "Grupo martes"). */}
        <div className="class-form__row">
          {showSaveTemplate ? (
            <div className="template-save">
              <input
                type="text"
                value={templateName}
                placeholder="Nombre de la plantilla (ej: Grupo martes)"
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveTemplate();
                  }
                }}
              />
              <button type="button" className="btn btn--small btn--primary" onClick={handleSaveTemplate}>
                Guardar plantilla
              </button>
              <button type="button" className="btn btn--small btn--ghost" onClick={() => setShowSaveTemplate(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowSaveTemplate(true)}>
              📋 Guardar como plantilla
            </button>
          )}
        </div>

        <div className="class-form__actions">
          {entry && (
            <button
              type="button"
              className="btn btn--small day-slot__delete-btn class-form__delete"
              onClick={async () => {
                if (
                  await dialog.confirm('¿Borrar este turno entero? Podés deshacerlo con "Deshacer".', {
                    danger: true,
                    confirmLabel: 'Borrar turno',
                  })
                ) {
                  deleteClass(day, initialStart);
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
