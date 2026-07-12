import { useRef, useState, type ChangeEvent } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { newId } from '../lib/id';
import { fileToCompressedDataURL } from '../lib/image';
import { PADEL_CATEGORIES, CATEGORY_LABELS, PADEL_RANKS, RANK_LABELS } from '../lib/students';
import DiscountEditor from './DiscountEditor';
import type { Discount, PadelCategory, PadelRank, Student } from '../types';

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
  const dialog = useDialog();

  const [firstName, setFirstName] = useState(student?.firstName ?? '');
  const [lastName, setLastName] = useState(student?.lastName ?? '');
  const [phone, setPhone] = useState(student?.phone ?? '');
  // Categoría y nivel son dos campos INDEPENDIENTES, ambos opcionales (v7).
  const [category, setCategory] = useState<PadelCategory | ''>(student?.category ?? '');
  const [rank, setRank] = useState<PadelRank | ''>(student?.rank ?? '');
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
      void dialog.alert('No se pudo procesar la imagen.');
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
      void dialog.alert('Ingresá al menos un nombre o apellido.');
      return;
    }
    const saved: Student = {
      id: student?.id ?? newId(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim() || undefined,
      category: category || undefined,
      rank: rank || undefined,
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

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Categoría</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as PadelCategory | '')}
            >
              <option value="">Sin categoría</option>
              {PADEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Nivel</label>
            <select className="select" value={rank} onChange={(e) => setRank(e.target.value as PadelRank | '')}>
              <option value="">Sin nivel</option>
              {PADEL_RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
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
