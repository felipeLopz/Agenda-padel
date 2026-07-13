interface TimeFieldProps {
  /** Hora de inicio en minutos desde la medianoche (misma representación que la agenda). */
  value: number;
  onChange: (minutes: number) => void;
  /** Paso de minutos para las opciones (default 5). */
  step?: number;
}

/**
 * Selector de hora propio: dos <select> (hora 00–23 + minutos), en vez del <input type="time">
 * nativo. Motivos: (1) el nativo quedaba con texto invisible y (2) en el celular su reloj se
 * salía de la pantalla. Los <select> usan el popup del sistema (siempre centrado y accesible en
 * el celular) y se tematizan con la paleta. Sigue permitiendo CUALQUIER horario con minutos.
 *
 * NO cambia cómo se guarda la hora: emite los mismos minutos-desde-medianoche que antes.
 */
export default function TimeField({ value, onChange, step = 5 }: TimeFieldProps) {
  const hour = Math.floor(value / 60);
  const minute = ((value % 60) + 60) % 60;

  // Minutos en pasos de `step`, más el minuto actual si no cae en la grilla, así al editar un
  // turno con una hora "rara" (ej: 9:37) no se pierde esa opción.
  const minutes: number[] = [];
  for (let m = 0; m < 60; m += step) minutes.push(m);
  if (!minutes.includes(minute)) {
    minutes.push(minute);
    minutes.sort((a, b) => a - b);
  }
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="time-field">
      <select
        className="select time-field__select"
        value={hour}
        aria-label="Hora"
        onChange={(e) => onChange(Number(e.target.value) * 60 + minute)}
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {pad(h)}
          </option>
        ))}
      </select>
      <span className="time-field__sep" aria-hidden>
        :
      </span>
      <select
        className="select time-field__select"
        value={minute}
        aria-label="Minutos"
        onChange={(e) => onChange(hour * 60 + Number(e.target.value))}
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {pad(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
