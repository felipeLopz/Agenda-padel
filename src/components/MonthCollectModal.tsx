import { useState } from 'react';
import Modal from './Modal';
import NumberInput from './NumberInput';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { MONTH_NAMES } from '../lib/constants';
import { displayName } from '../lib/students';
import { formatCurrency } from '../lib/format';
import { monthlyFeeFor, studentMonthStatus } from '../lib/money';

interface MonthCollectModalProps {
  studentId: string;
  /** Mes a cobrar, "YYYY-MM". */
  period: string;
  onClose: () => void;
}

/** "YYYY-MM" → "Julio 2026". */
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_NAMES[(m || 1) - 1]} ${y}`;
}

/**
 * Cobro del MES de un alumno mensual (v16). El importe viene precargado con la cuota (la parte
 * repartida entre sus clases del mes, que suma la cuota exacta) y es editable. Registra un
 * pago de tipo 'mes' que salda todas sus clases de ese mes; no se cobra clase por clase.
 */
export default function MonthCollectModal({ studentId, period, onClose }: MonthCollectModalProps) {
  const { data, ledger, collectMonth, undoCollectMonth } = useAgenda();
  const dialog = useDialog();
  const student = data.students[studentId];

  // Estado del mes según el ledger: cuánto es la cuota y cuánto está cobrado.
  const status = studentMonthStatus(ledger, studentId, period);
  const fee = status?.fee ?? monthlyFeeFor(student, period) ?? student?.billing?.amount ?? 0;
  const alreadyPaid = status?.paid ?? 0;
  const settled = status?.settled ?? false;
  // Por defecto se cobra lo que falta de la cuota (o la cuota entera si no se cobró nada).
  const [amount, setAmount] = useState<number>(Math.max(0, fee - alreadyPaid));
  const [methodId, setMethodId] = useState<string>(data.settings.defaultMethodId);

  if (!student) {
    onClose();
    return null;
  }

  function handleCollect() {
    if (amount <= 0) {
      void dialog.alert('Poné un importe mayor a cero.');
      return;
    }
    collectMonth(studentId, period, Number(amount), methodId);
    onClose();
  }

  async function handleUndo() {
    if (await dialog.confirm(`¿Deshacer el cobro del mes de ${periodLabel(period)}?`, { danger: true, confirmLabel: 'Deshacer' })) {
      undoCollectMonth(studentId, period);
      onClose();
    }
  }

  return (
    <Modal title={`Cobrar el mes · ${displayName(student)}`} onClose={onClose}>
      <div className="class-form">
        <p className="settings__hint">
          Cobrás <strong>{periodLabel(period)}</strong>: la cuota cubre todas las clases del alumno ese mes
          {status ? ` (${status.classes} clase${status.classes === 1 ? '' : 's'})` : ''}, caigan las que caigan. La
          cuota vigente es {formatCurrency(fee)}.
          {alreadyPaid > 0.01 && ` Ya lleva cobrado ${formatCurrency(alreadyPaid)} de este mes.`}
        </p>

        {settled ? (
          <>
            <p className="settings__hint text-paid">✓ Este mes ya está saldado.</p>
            <div className="class-form__actions">
              <button className="btn btn--ghost" onClick={onClose}>
                Cerrar
              </button>
              <button className="btn btn--danger" onClick={handleUndo}>
                Deshacer cobro del mes
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="class-form__row class-form__row--split">
              <div>
                <label>Importe a cobrar</label>
                <NumberInput min={0} value={amount} onChange={setAmount} />
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
              <button className="btn btn--primary" onClick={handleCollect}>
                Cobrar {formatCurrency(amount)}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
