// Feedback físico opcional: vibración (haptic) y un sonido muy breve al cobrar.
// Es SOLO UX; no toca datos ni plata. El sonido viene apagado por defecto y solo suena
// si el usuario lo activa en Configuración.

/** Vibración háptica sutil en el celular, si el dispositivo lo permite. */
export function haptic(ms: number | number[] = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no soportado: se ignora */
  }
}

/**
 * Sonido MUY breve y discreto al cobrar, generado con Web Audio (sin archivos). Solo
 * suena si `enabled` es true (viene de Configuración; apagado por defecto).
 */
export function playCollectSound(enabled: boolean): void {
  if (!enabled) return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Dos notas cortas ascendentes: un "tilín" agradable.
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
    osc.onended = () => ctx.close();
  } catch {
    /* audio no disponible: se ignora */
  }
}
