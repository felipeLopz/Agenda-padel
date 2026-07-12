import type { AgendaData, ClassType, Prices } from '../types';

/**
 * Precio sugerido por defecto según el tipo de clase.
 * Grupal = precio por alumno × cantidad de alumnos. Individual = precio fijo por clase.
 * Es solo un valor inicial: el importe final siempre se puede editar a mano.
 */
export function suggestedPrice(type: ClassType, studentCount: number, prices: Prices): number {
  if (type === 'grupal') return prices.grupal * Math.max(studentCount, 1);
  return prices.indiv;
}

/**
 * Montos frecuentes para ofrecer como botones al cargar un pago o un precio: los importes
 * que más se repiten en los pagos registrados, sembrados con los precios por defecto para
 * que siempre haya opciones. Solo LEE datos; no cambia ningún cálculo. Máximo 6.
 */
export function frequentAmounts(data: AgendaData): number[] {
  const counts = new Map<number, number>();
  for (const pay of Object.values(data.payments)) {
    const a = Math.round(pay.amount);
    if (a > 0) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const seed = [data.prices.grupal, data.prices.indiv].filter((n) => n > 0);
  const merged: number[] = [];
  for (const n of [...top, ...seed]) {
    if (n > 0 && !merged.includes(n)) merged.push(n);
    if (merged.length >= 6) break;
  }
  return merged;
}
