import { useEffect, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '../lib/motion';

// Colores de la paleta (pelotitas de pádel de colores).
const COLORS = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--amber)', 'var(--blue-light)'];

/** Estilo de una pelotita: posición, color, tiempos y deriva horizontal al caer. */
function pieceStyle(i: number): CSSProperties {
  const style: CSSProperties = {
    left: `${Math.random() * 100}%`,
    background: COLORS[i % COLORS.length],
    animationDelay: `${Math.random() * 0.15}s`,
    animationDuration: `${0.9 + Math.random() * 0.5}s`,
  };
  (style as Record<string, string>)['--drift'] = `${(Math.random() * 2 - 1) * 70}px`;
  return style;
}

/**
 * Festejo breve de pelotitas de colores (Tanda 4). Escucha el evento 'padel:celebrate'
 * (lo dispara `celebrate()`). Es SOLO visual y NO aparece si se pide menos movimiento.
 */
export default function Confetti() {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    function onCelebrate() {
      if (prefersReducedMotion()) return; // sin movimiento: no hay confeti
      const id = Date.now();
      setBursts((b) => [...b, id]);
      window.setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), 1500);
    }
    window.addEventListener('padel:celebrate', onCelebrate);
    return () => window.removeEventListener('padel:celebrate', onCelebrate);
  }, []);

  if (bursts.length === 0) return null;
  return (
    <div className="confetti" aria-hidden>
      {bursts.map((id) => (
        <div key={id} className="confetti__burst">
          {Array.from({ length: 26 }).map((_, i) => (
            <span key={i} className="confetti__piece" style={pieceStyle(i)} />
          ))}
        </div>
      ))}
    </div>
  );
}
