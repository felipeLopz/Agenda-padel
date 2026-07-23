import { useMemo } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { monthKeyOf, studentMonthStatus } from '../lib/money';
import { isChargeable } from '../lib/classMeta';

/** Un alumno a cobrar este mes (para el recordatorio del 1°). */
export interface MonthlyCollectItem {
  studentId: string;
  /** Es mensual (tiene cuota) o paga por clase (solo recordatorio, se cobra clase por clase). */
  monthly: boolean;
  /** Cuota del mes si es mensual (la parte repartida sumada). */
  fee: number;
  /** Cuánto le falta cobrar del mes (mensual) o su deuda de las clases del mes (por clase). */
  pending: number;
  settled: boolean;
  classes: number;
}

/**
 * Recordatorio del 1° de mes (v16): lista los alumnos con al menos una clase COBRABLE en el
 * mes actual, para acordarse de a quién cobrarle. Se DERIVA del ledger (no guarda estado
 * propio): un alumno mensual desaparece de "pendientes" cuando su mes queda saldado, así el
 * "marcar como cobrado" es el cobro mismo y nunca se desincroniza.
 *
 * `period` es el mes actual "YYYY-MM". `pendingCount` alimenta el contador de la campanita.
 */
export function useMonthlyCollection(): {
  period: string;
  items: MonthlyCollectItem[];
  pending: MonthlyCollectItem[];
  pendingCount: number;
  dismissed: boolean;
} {
  const { data, ledger } = useAgenda();

  return useMemo(() => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Alumnos con al menos una clase cobrable este mes (con ficha).
    const withClasses = new Set<string>();
    const debtByStudent: Record<string, number> = {};
    const countByStudent: Record<string, number> = {};
    for (const [day, slots] of Object.entries(data.days)) {
      if (monthKeyOf(day) !== period) continue;
      for (const entry of Object.values(slots)) {
        if (!isChargeable(entry)) continue;
        for (const p of entry.participants) {
          if (!p.studentId || !data.students[p.studentId]) continue;
          withClasses.add(p.studentId);
          countByStudent[p.studentId] = (countByStudent[p.studentId] ?? 0) + 1;
        }
      }
    }
    // Deuda por clase de este mes (para los que pagan por clase), derivada del ledger.
    for (const acc of Object.values(ledger.byStudent)) {
      for (const part of acc.participations) {
        if (monthKeyOf(part.day) !== period || part.coveredByPack || part.coveredByMonth) continue;
        const rem = part.owed - part.paidToward;
        if (rem > 0.0001) debtByStudent[acc.studentId] = (debtByStudent[acc.studentId] ?? 0) + rem;
      }
    }

    const items: MonthlyCollectItem[] = [];
    for (const studentId of withClasses) {
      const student = data.students[studentId];
      if (!student?.active) continue; // los archivados no se listan
      const monthly = student.billing?.mode === 'mensual';
      if (monthly) {
        const st = studentMonthStatus(ledger, studentId, period);
        items.push({
          studentId,
          monthly: true,
          fee: st?.fee ?? student.billing?.amount ?? 0,
          pending: st ? Math.max(0, st.fee - st.paid) : 0,
          settled: st?.settled ?? false,
          classes: st?.classes ?? countByStudent[studentId] ?? 0,
        });
      } else {
        const pending = debtByStudent[studentId] ?? 0;
        items.push({
          studentId,
          monthly: false,
          fee: 0,
          pending,
          settled: pending <= 0.0001,
          classes: countByStudent[studentId] ?? 0,
        });
      }
    }
    // Los mensuales primero, después por deuda descendente.
    items.sort((a, b) => Number(b.monthly) - Number(a.monthly) || b.pending - a.pending);

    const pending = items.filter((i) => !i.settled);
    const dismissed = data.settings.monthlyNoticeDismissed === period;
    return { period, items, pending, pendingCount: pending.length, dismissed };
  }, [data, ledger]);
}
