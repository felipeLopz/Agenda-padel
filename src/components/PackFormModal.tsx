import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { displayName } from '../lib/students';

interface PackFormModalProps {
  studentId: string;
  onClose: () => void;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Crear un pack (bono prepago) para un alumno: N clases pagas por adelantado. */
export default function PackFormModal({ studentId, onClose }: PackFormModalProps) {
  const { data, addPack } = useAgenda();
  const student = data.students[studentId];

  const [totalClasses, setTotalClasses] = useState<number>(8);
  const [price, setPrice] = useState<number>(0);
  const [date, setDate] = useState<string>(todayISO());
  const [methodId, setMethodId] = useState<string>(data.settings.defaultMethodId);

  if (!student) {
    onClose();
    return null;
  }

  function handleSave() {
    if (totalClasses <= 0) {
      alert('El pack debe tener al menos 1 clase.');
      return;
    }
    addPack({ studentId, totalClasses: Math.round(totalClasses), price: Number(price) || 0, date, methodId });
    onClose();
  }

  return (
    <Modal title={`Nuevo pack · ${displayName(student)}`} onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          El pack se paga por adelantado. Cada clase que tome el alumno descuenta 1 crédito automáticamente (de la
          más vieja a la más nueva) y esa clase no se vuelve a cobrar.
        </p>

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Cantidad de clases</label>
            <input type="number" min={1} value={totalClasses} onChange={(e) => setTotalClasses(Number(e.target.value))} />
          </div>
          <div>
            <label>Precio del pack</label>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
        </div>

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Fecha de compra</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label>Medio de pago</label>
            <select className="select" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              {data.paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Crear pack
          </button>
        </div>
      </div>
    </Modal>
  );
}
