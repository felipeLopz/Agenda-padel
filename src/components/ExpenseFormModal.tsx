import { useState } from 'react';
import Modal from './Modal';
import NumberInput from './NumberInput';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { newId } from '../lib/id';
import type { Expense } from '../types';

interface ExpenseFormModalProps {
  /** Gasto a editar; null para alta. */
  expense: Expense | null;
  onClose: () => void;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Alta / edición de un gasto del profesor. */
export default function ExpenseFormModal({ expense, onClose }: ExpenseFormModalProps) {
  const { upsertExpense } = useAgenda();
  const dialog = useDialog();
  const [concept, setConcept] = useState(expense?.concept ?? '');
  const [amount, setAmount] = useState<number>(expense?.amount ?? 0);
  const [date, setDate] = useState<string>(expense?.date ?? todayISO());

  function handleSave() {
    if (!concept.trim()) {
      void dialog.alert('Ingresá un concepto.');
      return;
    }
    if (!amount || amount <= 0) {
      void dialog.alert('Ingresá un monto mayor a 0.');
      return;
    }
    const saved: Expense = { id: expense?.id ?? newId(), concept: concept.trim(), amount, date };
    upsertExpense(saved);
    onClose();
  }

  return (
    <Modal title={expense ? 'Editar gasto' : 'Nuevo gasto'} onClose={onClose}>
      <div className="class-form">
        <div className="class-form__row">
          <label>Concepto</label>
          <input
            type="text"
            value={concept}
            placeholder="Ej: alquiler de cancha, pelotas..."
            onChange={(e) => setConcept(e.target.value)}
          />
        </div>
        <div className="class-form__row class-form__row--split">
          <div>
            <label>Monto</label>
            <NumberInput min={0} value={amount} onChange={setAmount} />
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
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
