import NumberInput from './NumberInput';
import type { Discount } from '../types';

interface DiscountEditorProps {
  value: Discount | undefined;
  onChange: (discount: Discount | undefined) => void;
  /** Texto chico de ayuda (opcional). */
  hint?: string;
}

/** Editor compacto de descuento: Ninguno / Porcentaje / Monto fijo + valor. */
export default function DiscountEditor({ value, onChange, hint }: DiscountEditorProps) {
  const kind = value ? value.type : 'none';

  function setKind(next: 'none' | 'percent' | 'fixed') {
    if (next === 'none') onChange(undefined);
    else onChange({ type: next, value: value?.value ?? 0 });
  }

  return (
    <div className="discount-editor">
      <select
        className="discount-editor__kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as 'none' | 'percent' | 'fixed')}
      >
        <option value="none">Sin descuento</option>
        <option value="percent">Porcentaje %</option>
        <option value="fixed">Monto fijo $</option>
      </select>
      {value && (
        <NumberInput
          className="discount-editor__value"
          min={0}
          value={value.value}
          placeholder={value.type === 'percent' ? '%' : '$'}
          onChange={(n) => onChange({ type: value.type, value: n })}
        />
      )}
      {hint && <span className="discount-editor__hint">{hint}</span>}
    </div>
  );
}
