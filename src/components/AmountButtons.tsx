import { formatCurrency } from '../lib/format';

interface AmountButtonsProps {
  /** Montos a ofrecer (ya calculados: ver lib/pricing.frequentAmounts). */
  amounts: number[];
  onPick: (amount: number) => void;
}

/**
 * Botones de montos frecuentes para cargar un pago o un precio sin tipear. Es solo un atajo
 * de entrada: escribe el número en el campo correspondiente, no cambia ningún cálculo.
 */
export default function AmountButtons({ amounts, onPick }: AmountButtonsProps) {
  if (amounts.length === 0) return null;
  return (
    <div className="amount-buttons">
      {amounts.map((a) => (
        <button key={a} type="button" className="amount-chip" onClick={() => onPick(a)}>
          {formatCurrency(a)}
        </button>
      ))}
    </div>
  );
}
