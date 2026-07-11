import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { parseDayKey } from '../lib/date';
import { WEEKDAY_NAMES_LONG } from '../lib/constants';
import { suggestedPrice } from '../lib/pricing';
import { participantName } from '../lib/students';
import type { ClassEntry, ClassFormTarget, ClassParticipant, ClassType } from '../types';
import StudentPicker from './StudentPicker';
import DiscountEditor from './DiscountEditor';

interface ClassFormModalProps {
  target: ClassFormTarget;
  onClose: () => void;
}

function emptyParticipant(): ClassParticipant {
  return { studentId: null, name: '' };
}

/** Cuenta participantes con nombre no vacío. */
function countFilled(list: ClassParticipant[]): number {
  return list.filter((p) => p.studentId || p.name.trim()).length;
}

/** Alta y edición de una clase (grupal o individual) en una franja día/hora. */
export default function ClassFormModal({ target, onClose }: ClassFormModalProps) {
  const { data, upsertClass, quickCollectClass } = useAgenda();
  const { day, hour, entry } = target;

  const [type, setType] = useState<ClassType>(entry?.type ?? 'grupal');
  const [participants, setParticipants] = useState<ClassParticipant[]>(
    entry?.participants.length ? entry.participants : [emptyParticipant()]
  );
  const [priceTouched, setPriceTouched] = useState(Boolean(entry));
  const [price, setPrice] = useState<number>(entry?.price ?? suggestedPrice('grupal', 1, data.prices));
  // Solo se ofrece "cobrar al guardar" al crear una clase nueva.
  const [collectNow, setCollectNow] = useState(false);
  // Mostrar el editor de descuento puntual por participante (colapsado por defecto).
  const [showDiscounts, setShowDiscounts] = useState(
    Boolean(entry?.participants.some((p) => p.discount))
  );

  function recalcPrice(nextType: ClassType, nextList: ClassParticipant[]) {
    if (priceTouched) return;
    const count = nextType === 'grupal' ? Math.max(countFilled(nextList), 1) : 1;
    setPrice(suggestedPrice(nextType, count, data.prices));
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
    const finalEntry: ClassEntry = { type, participants: finalList, price: Number(price) || 0 };
    upsertClass(day, hour, finalEntry);
    // Cobro rápido opcional al crear (usa el medio por defecto, fecha de hoy).
    if (collectNow && !entry) {
      // Se difiere para que corra después de que el estado tenga la clase nueva.
      setTimeout(() => quickCollectClass(day, hour), 0);
    }
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
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowDiscounts((v) => !v)}
            >
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

        <div className="class-form__row">
          <label>Importe (precio de lista de la clase)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => {
              setPriceTouched(true);
              setPrice(Number(e.target.value));
            }}
          />
        </div>

        {!entry && (
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
