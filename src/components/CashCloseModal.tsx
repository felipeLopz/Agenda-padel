import { useState } from 'react';
import Modal from './Modal';
import { useAgenda } from '../state/AgendaContext';
import { formatCurrency } from '../lib/format';
import { cashClose } from '../lib/money';

interface CashCloseModalProps {
  onClose: () => void;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO "YYYY-MM-DD" → clave de día del calendario "AÑO-MES0-DIA". */
function isoToDayKey(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${m - 1}-${d}`;
}

/** Cierre de caja de un día: cuánto entró, por qué medios, y lo pendiente. */
export default function CashCloseModal({ onClose }: CashCloseModalProps) {
  const { data, ledger } = useAgenda();
  const [iso, setIso] = useState<string>(todayISO());

  const close = cashClose(data, ledger, isoToDayKey(iso));

  return (
    <Modal title="Cierre de caja" onClose={onClose}>
      <div className="class-form">
        <div className="class-form__row">
          <label>Día</label>
          <input type="date" value={iso} onChange={(e) => setIso(e.target.value)} />
        </div>

        <div className="cash-close">
          <div className="cash-close__total">
            <span>Cobrado en el día</span>
            <strong className="text-paid">{formatCurrency(close.totalCollected)}</strong>
          </div>

          <div className="cash-close__methods">
            {close.byMethod.map((m) => (
              <div key={m.methodId} className="cash-close__method">
                <span>{m.label}</span>
                <span>{formatCurrency(m.amount)}</span>
              </div>
            ))}
          </div>

          <div className="cash-close__pending">
            <span>Pendiente de las clases del día</span>
            <strong className="text-pending">{formatCurrency(close.pending)}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}
