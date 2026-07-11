import { useRef } from 'react';

/**
 * Devuelve 'left' o 'right' según si el valor (ej: semana, mes, año) bajó o subió
 * respecto del render anterior. Se usa para deslizar el contenido en esa dirección al
 * cambiar de período. Solo visual.
 */
export function useSlideDirection(value: number): 'left' | 'right' {
  const prev = useRef(value);
  const dir: 'left' | 'right' = value < prev.current ? 'left' : 'right';
  prev.current = value;
  return dir;
}
