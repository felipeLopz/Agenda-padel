/** Formatea montos en pesos argentinos con separador de miles: "$1.000". */
export function formatCurrency(value: number): string {
  const rounded = Math.round(value || 0);
  return '$' + rounded.toLocaleString('es-AR');
}
