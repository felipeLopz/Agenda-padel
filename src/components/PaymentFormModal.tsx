import { useState } from 'react';
import Modal from './Modal';
import NumberInput from './NumberInput';
import { useAgenda } from '../state/AgendaContext';
import { formatCurrency } from '../lib/format';
import { displayName } from '../lib/students';
import { downloadReceipt } from '../lib/receipt';
import type { Payment } from '../types';

interface PaymentFormModalProps {
  studentId: string;
  onClose: () => void;
  /** Monto sugerido (por defecto, el saldo del alumno). */
  defaultAmount?: number;
  /** Si el pago salda una clase puntual. */
  classRef?: { day: string; hour: number };
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Registrar un pago de un alumno (total o parcial), con medio y recibo opcional. */
export default function PaymentFormModal({ studentId, onClose, defaultAmount, classRef }: PaymentFormModalProps) {
  const { data, ledger, addPayment } = useAgenda();
  const student = data.students[studentId];
  const balance = ledger.byStudent[studentId]?.balance ?? 0;

  const [amount, setAmount] = useState<number>(defaultAmount ?? Math.max(0, Math.round(balance)));
  const [methodId, setMethodId] = useState<string>(data.settings.defaultMethodId);
  const [date, setDate] = useState<string>(todayISO());
  const [concept, setConcept] = useState<string>(classRef ? 'Cobro de clase' : 'Pago de clases');

  if (!student) {
    onClose();
    return null;
  }

  function register(): Payment | null {
    if (!amount || amount <= 0) {
      alert('Ingresá un monto mayor a 0.');
      return null;
    }
    return addPayment({ studentId, amount, methodId, date, concept: concept.trim() || undefined, kind: 'clase', classRef });
  }

  function handleSave() {
    if (register()) onClose();
  }

  function handleSaveWithReceipt() {
    const payment = register();
    if (!payment) return;
    const methodLabel = data.paymentMethods.find((m) => m.id === methodId)?.label ?? methodId;
    downloadReceipt({ payment, student, methodLabel });
    onClose();
  }

  return (
    <Modal title={`Registrar pago · ${displayName(student)}`} onClose={onClose}>
      <div className="class-form">
        <div className="payment-balance">
          Saldo actual: <strong className={balance > 0 ? 'text-pending' : 'text-paid'}>{formatCurrency(balance)}</strong>
        </div>

        <div className="class-form__row class-form__row--split">
          <div>
            <label>Monto</label>
            <NumberInput value={amount} min={0} onChange={setAmount} />
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="class-form__row">
          <label>Medio de pago</label>
          <select className="select" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
            {data.paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="class-form__row">
          <label>Concepto (para el recibo)</label>
          <input type="text" value={concept} onChange={(e) => setConcept(e.target.value)} />
        </div>

        <div className="class-form__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" onClick={handleSaveWithReceipt}>
            Guardar + recibo
          </button>
          <button className="btn btn--primary" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
