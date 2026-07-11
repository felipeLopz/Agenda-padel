import { useEffect, useMemo, useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import type { ClassEntry, Reminder } from '../types';

export interface DueReminder {
  day: string;
  hour: number;
  entry: ClassEntry;
  reminder: Reminder;
  /** Momento del aviso en ms (para ordenar/comparar). */
  at: number;
}

/**
 * Recorre los turnos y separa los recordatorios (no marcados como hechos) en:
 *  - `due`: ya llegó su hora (remindAt <= ahora) → pendientes de ver.
 *  - `upcoming`: todavía no llegaron.
 * Revisa la hora cada 30 s, así los pendientes aparecen solos cuando llega el momento;
 * al abrir la app se recalcula y muestra los que habían quedado. Es SOLO lectura.
 */
export function useReminders(): { due: DueReminder[]; upcoming: DueReminder[]; dueCount: number } {
  const { data } = useAgenda();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const due: DueReminder[] = [];
    const upcoming: DueReminder[] = [];
    for (const [day, slots] of Object.entries(data.days)) {
      for (const [hourStr, entry] of Object.entries(slots)) {
        const r = entry.reminder;
        if (!r || r.done) continue;
        const at = new Date(r.remindAt).getTime();
        if (Number.isNaN(at)) continue;
        const item: DueReminder = { day, hour: Number(hourStr), entry, reminder: r, at };
        if (at <= now) due.push(item);
        else upcoming.push(item);
      }
    }
    due.sort((a, b) => a.at - b.at);
    upcoming.sort((a, b) => a.at - b.at);
    return { due, upcoming, dueCount: due.length };
  }, [data, now]);
}
