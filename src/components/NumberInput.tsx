import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
};

/**
 * Campo numérico para precios/importes/cantidades.
 *
 * Arregla el comportamiento feo al editar: cuando borrás todo, el campo queda EN BLANCO
 * (no en 0), y no deja ceros pegados adelante ("020000" → "20000"). Un campo vacío se
 * interpreta como 0 hacia afuera (`onChange(0)`), pero VISUALMENTE se muestra vacío.
 *
 * NO cambia ningún cálculo ni la lógica de la plata: solo el comportamiento del campo.
 * Si el valor cambia DESDE AFUERA (ej: la sugerencia automática de precio), el campo lo
 * refleja, sin pisar lo que estás tipeando.
 */
export default function NumberInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(() => (value ? String(value) : ''));
  const lastNum = useRef(value);

  useEffect(() => {
    if (value !== lastNum.current) {
      lastNum.current = value;
      setText(value ? String(value) : '');
    }
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value;
    // Saca ceros a la izquierda pegados a otro dígito (deja "0" solo y "0.5").
    if (raw.length > 1) raw = raw.replace(/^0+(?=\d)/, '');
    setText(raw);
    const n = raw === '' ? 0 : Number(raw);
    const val = Number.isFinite(n) ? n : 0;
    lastNum.current = val;
    onChange(val);
  }

  return <input type="number" inputMode="decimal" value={text} onChange={handleChange} {...rest} />;
}
