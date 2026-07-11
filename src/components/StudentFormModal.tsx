import { useRef, useState, type ChangeEvent } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { newId } from '../lib/id';
import { fileToCompressedDataURL } from '../lib/image';
import { LEVELS, LEVEL_LABELS } from '../lib/students';
import DiscountEditor from './DiscountEditor';
import type { Discount, Student, StudentLevel } from '../types';

interface StudentFormModalProps {
  /** Ficha a editar; null para alta. */
  student: Student | null;
  onClose: () => void;
  /** Se llama con la ficha guardada (útil para abrirla luego). */
  onSaved?: (student: Student) => void;
}

/** Alta y edición de una ficha de alumno. */
export default function StudentFormModal({ student, onClose, onSaved }: StudentFormModalProps) {
  const { upsertStudent } = useAgenda();

  const [firstName, setFirstName] = useState(student?.firstName ?? '');
  const [lastName, setLastName] = useState(student?.lastName ?? '');
  const [phone, setPhone] = useState(student?.phone ?? '');
  const [level, setLevel] = useState<StudentLevel>(student?.level ?? 'principiante');
  const [birthday, setBirthday] = useState(student?.birthday ?? '');
  const [notes, setNotes] = useState(student?.notes ?? '');
  const [photo, setPhoto] = useState<string | undefined>(student?.photo);
  const [tags, setTags] = useState<string[]>(student?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [discount, setDiscount] = useState<Discount | undefined>(student?.discount);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await fileToCompressedDataURL(file));
    } catch {
      alert('No se pudo procesar la imagen.');
    } finally {
      e.target.value = '';
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSave() {
    if (!firstName.trim() && !lastName.trim()) {
      alert('Ingresá al menos un nombre o apellido.');
      return;
    }
    const saved: Student = {
      id: student?.id ?? newId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim() || undefined,
      level,
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
      photo,
      tags,
      discount: discount && discount.value > 0 ? discount : undefined,
      active: student?.active ?? true,
      createdAt: student?.createdAt ?? new Date().toISOString(),
    };
    upsertStudent(saved);
    onSaved?.(saved);
    onClose();
  }

  return (
    <Modal title={student ? 'Editar alumno' : 'Nuevo alumno'} onClose={onClose}>
      <div className="student-form">
        <div className="student-form__photo-row">
          <div className="student-avatar student-avatar--lg">
            {photo ? (
              <img src={photo} alt="Foto del alumno" />
            ) : (
              <span className="student-avatar__initials">
                {(firstName[0] ?? '?').toUpperCase()}
              </span>
            )}
          </div>
          <div className="student-form__photo-actions">
            <button className="btn btn--ghost btn--small" onClick={() => fileRef.current?.click()}>
              {photo ? 'Cambiar foto' : 'Subir foto'}
            </button>
            {photo && (
              <button className="btn btn--ghost btn--small" onClick={() => setPhoto(undefined)}>
                Quitar
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handlePhoto}
            />
          </div>
        </div>

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Nombre</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label>Apellido</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="class-form__row">
          <label>Teléfono</label>
          <input
            type="tel"
            value={phone}
            placeholder="Ej: 2613900039"
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div className="class-form__row">
          <label>Nivel</label>
          <div className="segmented segmented--wrap">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                className={`segmented__option${level === lv ? ' segmented__option--active' : ''}`}
                onClick={() => setLevel(lv)}
              >
                {LEVEL_LABELS[lv]}
              </button>
            ))}
          </div>
        </div>

        <div className="class-form__row">
          <label>Cumpleaños</label>
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>

        <div className="class-form__row">
          <label>Etiquetas</label>
          <div className="tag-editor">
            <div className="tag-editor__chips">
              {tags.map((t) => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" onClick={() => removeTag(t)} aria-label={`Quitar ${t}`}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="tag-editor__input">
              <input
                type="text"
                value={tagInput}
                placeholder="Ej: zurdo, paga puntual..."
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" className="btn btn--ghost btn--small" onClick={addTag}>
                + Agregar
              </button>
            </div>
          </div>
        </div>

        <div className="class-form__row">
          <label>Descuento fijo (se aplica a todas sus clases)</label>
          <DiscountEditor value={discount} onChange={setDiscount} hint="permanente" />
        </div>

        <div className="class-form__row">
          <label>Notas privadas</label>
          <textarea
            className="student-form__notes"
            value={notes}
            rows={3}
            placeholder="Ej: mejorar el revés, lesión de rodilla..."
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

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
