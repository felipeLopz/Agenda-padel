import type { ClassType, Prices } from '../types';

/**
 * Precio sugerido por defecto según el tipo de clase.
 * Grupal = precio por alumno × cantidad de alumnos. Individual = precio fijo por clase.
 * Es solo un valor inicial: el importe final siempre se puede editar a mano.
 */
export function suggestedPrice(type: ClassType, studentCount: number, prices: Prices): number {
  if (type === 'grupal') return prices.grupal * Math.max(studentCount, 1);
  return prices.indiv;
}
