import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

interface CountUpProps {
  value: number;
  /** Formato del número (ej. formatCurrency). Se aplica en cada paso → siempre redondeado. */
  format?: (n: number) => string;
  /** Duración de la animación en ms (por defecto 600, siempre < 1s). */
  duration?: number;
}

/**
 * Muestra un número animándolo (contador que sube) hasta su valor (Tanda 2 de efectos).
 * Es SOLO visual: el valor final es EXACTO y sale formateado/redondeado en cada paso, así
 * no se ven decimales raros. Respeta prefers-reduced-motion (muestra el final de una).
 */
export default function CountUp({ value, format = (n) => String(Math.round(n)), duration = 600 }: CountUpProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0));
  const displayRef = useRef(display);
  displayRef.current = display;
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t); // easeOut: arranca rápido y frena
      if (t >= 1) {
        setDisplay(value); // valor final exacto
        rafRef.current = null;
      } else {
        setDisplay(from + (value - from) * eased);
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <>{format(display)}</>;
}
