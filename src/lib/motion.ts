/**
 * ¿El sistema del usuario pide menos animación? Se usa para APAGAR los efectos hechos
 * por JavaScript (contadores, dibujo de gráficos). Los efectos CSS ya se reducen solos
 * con la media query `@media (prefers-reduced-motion: reduce)` en global.css.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
