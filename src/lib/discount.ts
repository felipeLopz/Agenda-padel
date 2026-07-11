import type { Discount } from '../types';

/** Aplica un descuento a un monto. Devuelve el monto ya descontado (mínimo 0). */
export function applyDiscount(amount: number, discount: Discount | undefined): number {
  if (!discount) return amount;
  if (discount.type === 'percent') {
    return Math.max(0, amount * (1 - discount.value / 100));
  }
  // Monto fijo: resta pesos, sin bajar de 0.
  return Math.max(0, amount - discount.value);
}

/**
 * Aplica en cadena el descuento FIJO de la ficha y luego el PUNTUAL de la clase.
 * Orden definido: primero el fijo, después el puntual (el puntual se calcula sobre
 * el precio ya descontado por el fijo).
 */
export function applyDiscountChain(
  amount: number,
  fixedDiscount: Discount | undefined,
  oneTimeDiscount: Discount | undefined
): number {
  return applyDiscount(applyDiscount(amount, fixedDiscount), oneTimeDiscount);
}

/** Etiqueta legible de un descuento, ej "20%" o "$1.500". */
export function describeDiscount(discount: Discount): string {
  if (discount.type === 'percent') return `${discount.value}%`;
  return '$' + Math.round(discount.value).toLocaleString('es-AR');
}
