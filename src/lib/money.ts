// Cerebro financiero (v3). Todo el cálculo de plata vive acá, en funciones puras,
// para tener una sola fuente de verdad y poder testearlo.
//
// Idea central: el estado cobrado/pendiente de cada clase NO se guarda, se DERIVA.
// `computeLedger(data)` hace una sola pasada y devuelve, por alumno y por clase:
//  - la parte neta (tras descuentos fijo + puntual),
//  - qué clases cubre cada pack (consumo FIFO por fecha),
//  - cuánto está cobrado (pagos aplicados FIFO, más lo cubierto por packs),
//  - el saldo del alumno y el estado (pagada / parcial / impaga) de cada clase.

import type {
  AgendaData,
  ClassEntry,
  Expense,
  Pack,
  Payment,
  Student,
} from '../types';
import { parseDayKey } from './date';
import { applyDiscount } from './discount';
import { isChargeable } from './classMeta';

export type ClassPayStatus = 'pagada' | 'parcial' | 'impaga';
/** Estado de una clase, o "sin-seguimiento" si no tiene participantes con ficha. */
export type ClassStatus = ClassPayStatus | 'sin-seguimiento';

/** Etiquetas legibles de cada estado de cobro. */
export const STATUS_LABEL: Record<ClassStatus, string> = {
  pagada: 'Pagada',
  parcial: 'Parcial',
  impaga: 'Impaga',
  'sin-seguimiento': 'Sin seguimiento',
};

export interface Participation {
  day: string;
  /** Hora de inicio de la clase en minutos desde la medianoche (v10). */
  start: number;
  entry: ClassEntry;
  studentId: string;
  /** Parte bruta = precio ÷ cantidad de participantes. */
  gross: number;
  /** Parte neta tras descuentos (fijo de ficha + puntual de la clase). */
  net: number;
  coveredByPack: boolean;
  packId?: string;
  /** Adeudado en efectivo (0 si lo cubre un pack). */
  owed: number;
  /** Cuánto del adeudado está cubierto por pagos (asignados FIFO). */
  paidToward: number;
  status: ClassPayStatus;
}

export interface StudentAccount {
  studentId: string;
  participations: Participation[];
  billed: number;
  discounts: number;
  packCovered: number;
  owed: number;
  paid: number;
  /** Saldo: owed − paid. Positivo = debe; negativo = saldo a favor. */
  balance: number;
}

export interface ClassAccount {
  gross: number;
  collected: number;
  pending: number;
  status: ClassStatus;
}

export interface PackStatus {
  pack: Pack;
  consumed: number;
  remaining: number;
  low: boolean;
  empty: boolean;
}

export interface Ledger {
  byStudent: Record<string, StudentAccount>;
  byClass: Record<string, ClassAccount>;
  packs: Record<string, PackStatus>;
  debtors: Array<{ studentId: string; balance: number }>;
  totalOwed: number;
}

/** Clave de una clase en el ledger (día + inicio en minutos). */
export function classKey(day: string, start: number): string {
  return `${day}|${start}`;
}

/**
 * Parte "bruta" (antes de descuentos) de un alumno en una clase.
 * Grupal y Doble (v8/v14): el precio PROPIO del alumno, sin dividir. Individual: el precio de
 * la clase. Fallback al prorrateo viejo (precio ÷ cantidad) por si faltara el precio propio.
 */
export function participantGross(entry: ClassEntry, participantIndex: number): number {
  if (entry.type === 'grupal' || entry.type === 'doble') {
    const own = entry.participants[participantIndex]?.price;
    return typeof own === 'number' ? own : entry.price / (entry.participants.length || 1);
  }
  return entry.price;
}

/**
 * Desglose de la parte de un participante en una clase, para mostrar de dónde
 * viene cada descuento. Primero el fijo de la ficha, después el puntual de la clase.
 */
export function shareBreakdown(entry: ClassEntry, participantIndex: number, student: Student | undefined) {
  const gross = participantGross(entry, participantIndex);
  const participant = entry.participants[participantIndex];
  const afterFixed = applyDiscount(gross, student?.discount);
  const net = applyDiscount(afterFixed, participant?.discount);
  return {
    gross,
    afterFixed,
    net,
    fixedDiscount: student?.discount,
    oneTimeDiscount: participant?.discount,
    fixedAmount: gross - afterFixed,
    oneTimeAmount: afterFixed - net,
  };
}

/** "YYYY-MM-DD" → timestamp (medianoche local). */
function isoToTime(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

/** Ordena por fecha de clase (día + inicio en minutos). */
function participationTime(day: string, start: number): number {
  return parseDayKey(day).getTime() + start * 60 * 1000;
}

/**
 * Calcula todo el estado financiero derivado en una sola pasada.
 * Solo se rastrean participantes con ficha (studentId); los nombres sueltos
 * cuentan para el precio de la clase pero no generan deuda ni cobro.
 */
export function computeLedger(data: AgendaData): Ledger {
  // 1) Juntar participaciones por alumno.
  const partsByStudent: Record<string, Participation[]> = {};
  for (const [day, slots] of Object.entries(data.days)) {
    for (const [startStr, entry] of Object.entries(slots)) {
      // Las clases canceladas no generan plata (ni deuda ni cobro).
      if (!isChargeable(entry)) continue;
      const start = Number(startStr);
      entry.participants.forEach((p, idx) => {
        if (!p.studentId || !data.students[p.studentId]) return;
        const { gross, net } = shareBreakdown(entry, idx, data.students[p.studentId]);
        (partsByStudent[p.studentId] ??= []).push({
          day,
          start,
          entry,
          studentId: p.studentId,
          gross,
          net,
          coveredByPack: false,
          owed: net,
          paidToward: 0,
          status: 'impaga',
        });
      });
    }
  }

  const packStatus: Record<string, PackStatus> = {};
  // Inicializar packs (consumo se calcula abajo).
  for (const pack of Object.values(data.packs)) {
    packStatus[pack.id] = { pack, consumed: 0, remaining: pack.totalClasses, low: false, empty: pack.totalClasses <= 0 };
  }

  const byStudent: Record<string, StudentAccount> = {};

  for (const [studentId, parts] of Object.entries(partsByStudent)) {
    // Ordenar sus clases por fecha ascendente.
    parts.sort((a, b) => participationTime(a.day, a.start) - participationTime(b.day, b.start));

    // 2) Cobertura por packs (FIFO): packs del alumno por fecha de compra.
    const studentPacks = Object.values(data.packs)
      .filter((pk) => pk.studentId === studentId)
      .sort((a, b) => isoToTime(a.purchaseDate) - isoToTime(b.purchaseDate));

    for (const part of parts) {
      const partDayTime = parseDayKey(part.day).getTime();
      for (const pk of studentPacks) {
        const st = packStatus[pk.id];
        if (st.remaining <= 0) continue;
        if (isoToTime(pk.purchaseDate) > partDayTime) continue; // el pack no cubre clases previas a su compra
        st.remaining -= 1;
        st.consumed += 1;
        part.coveredByPack = true;
        part.packId = pk.id;
        part.owed = 0;
        break;
      }
    }

    // 3) Aplicar los pagos del alumno (excluyendo compras de pack).
    //    - Los pagos con `classRef` (cobro rápido de una clase) se aplican a ESA clase.
    //    - Los pagos libres (de la ficha) van FIFO a lo adeudado, de lo más viejo a lo nuevo.
    const studentPays = Object.values(data.payments).filter(
      (pay) => pay.studentId === studentId && pay.kind !== 'pack'
    );
    const totalPaid = studentPays.reduce((s, pay) => s + pay.amount, 0);

    const tiedByKey: Record<string, number> = {};
    let freePool = 0;
    for (const pay of studentPays) {
      if (pay.classRef) {
        const k = classKey(pay.classRef.day, pay.classRef.start);
        tiedByKey[k] = (tiedByKey[k] ?? 0) + pay.amount;
      } else {
        freePool += pay.amount;
      }
    }

    // 3a) Pagos atados a su clase (el sobrante vuelve al pool libre).
    for (const part of parts) {
      if (part.coveredByPack) continue;
      const k = classKey(part.day, part.start);
      const tied = tiedByKey[k];
      if (!tied) continue;
      const applied = Math.min(part.owed, tied);
      part.paidToward += applied;
      const overflow = tied - applied;
      if (overflow > 0) freePool += overflow;
      tiedByKey[k] = 0;
    }

    // 3b) Pool libre repartido FIFO sobre lo que sigue adeudado (más viejo primero).
    for (const part of parts) {
      if (part.coveredByPack) continue;
      const remaining = part.owed - part.paidToward;
      if (remaining <= 0) continue;
      const take = Math.min(remaining, freePool);
      part.paidToward += take;
      freePool -= take;
    }

    // 3c) Estado final de cada participación.
    for (const part of parts) {
      if (part.coveredByPack) part.status = 'pagada';
      else if (part.paidToward >= part.owed) part.status = 'pagada';
      else if (part.paidToward > 0) part.status = 'parcial';
      else part.status = 'impaga';
    }

    // 4) Totales del alumno.
    const billed = parts.reduce((s, p) => s + p.gross, 0);
    const discounts = parts.reduce((s, p) => s + (p.gross - p.net), 0);
    const packCovered = parts.reduce((s, p) => s + (p.coveredByPack ? p.net : 0), 0);
    const owed = parts.reduce((s, p) => s + p.owed, 0);
    byStudent[studentId] = {
      studentId,
      participations: parts,
      billed,
      discounts,
      packCovered,
      owed,
      paid: totalPaid,
      balance: owed - totalPaid,
    };
  }

  // Marcar avisos de pack (por agotarse / agotado).
  const threshold = data.settings.packLowThreshold;
  for (const st of Object.values(packStatus)) {
    st.empty = st.remaining <= 0;
    st.low = st.remaining > 0 && st.remaining <= threshold;
  }

  // 5) Agregado por clase (para colorear y para los totales por período).
  const byClass: Record<string, ClassAccount> = {};
  for (const [day, slots] of Object.entries(data.days)) {
    for (const [startStr, entry] of Object.entries(slots)) {
      const start = Number(startStr);
      const key = classKey(day, start);
      const parts: Participation[] = [];
      for (const acc of Object.values(byStudent)) {
        for (const p of acc.participations) {
          if (p.day === day && p.start === start) parts.push(p);
        }
      }
      let collected = 0;
      let pending = 0;
      let allPaid = true;
      let anyCollected = false;
      for (const p of parts) {
        const c = p.coveredByPack ? p.net : p.paidToward;
        const pend = p.coveredByPack ? 0 : p.owed - p.paidToward;
        collected += c;
        pending += pend;
        if (pend > 0.0001) allPaid = false;
        if (c > 0.0001) anyCollected = true;
      }
      let status: ClassStatus;
      if (parts.length === 0) status = 'sin-seguimiento';
      else if (allPaid) status = 'pagada';
      else if (anyCollected) status = 'parcial';
      else status = 'impaga';
      byClass[key] = { gross: entry.price, collected, pending, status };
    }
  }

  // 6) Ranking de deudores y total adeudado.
  const debtors = Object.values(byStudent)
    .filter((a) => a.balance > 0.0001)
    .map((a) => ({ studentId: a.studentId, balance: a.balance }))
    .sort((a, b) => b.balance - a.balance);
  const totalOwed = debtors.reduce((s, d) => s + d.balance, 0);

  return { byStudent, byClass, packs: packStatus, debtors, totalOwed };
}

/** Estado de una clase desde el ledger (o "sin-seguimiento" si no está). */
export function classStatus(ledger: Ledger, day: string, start: number): ClassStatus {
  return ledger.byClass[classKey(day, start)]?.status ?? 'sin-seguimiento';
}

// ---------------------------------------------------------------------------
// Totales por período (barra superior anual, pie de mes, agenda del día).
// ---------------------------------------------------------------------------

export interface Totals {
  classes: number;
  students: number;
  collected: number;
  pending: number;
  total: number;
}

export function emptyTotals(): Totals {
  return { classes: 0, students: 0, collected: 0, pending: 0, total: 0 };
}

/** Clases de un día, ordenadas por hora de inicio (en minutos) ascendente. */
export function dayEntries(
  slots: Record<string, ClassEntry> | undefined
): Array<{ start: number; entry: ClassEntry }> {
  if (!slots) return [];
  return Object.entries(slots)
    .map(([start, entry]) => ({ start: Number(start), entry }))
    .sort((a, b) => a.start - b.start);
}

function accumulate(data: AgendaData, ledger: Ledger, matches: (day: string) => boolean): Totals {
  const t = emptyTotals();
  for (const [day, slots] of Object.entries(data.days)) {
    if (!matches(day)) continue;
    for (const [startStr, entry] of Object.entries(slots)) {
      // Las clases canceladas no cuentan en los totales.
      if (!isChargeable(entry)) continue;
      const acc = ledger.byClass[classKey(day, Number(startStr))];
      t.classes += 1;
      t.students += entry.participants.length;
      t.total += entry.price;
      t.collected += acc?.collected ?? 0;
      t.pending += acc?.pending ?? 0;
    }
  }
  return t;
}

export function dayTotals(data: AgendaData, ledger: Ledger, dayKey: string): Totals {
  return accumulate(data, ledger, (d) => d === dayKey);
}

export function monthTotals(data: AgendaData, ledger: Ledger, year: number, month: number): Totals {
  return accumulate(data, ledger, (d) => {
    const [y, m] = d.split('-').map(Number);
    return y === year && m === month;
  });
}

export function yearTotals(data: AgendaData, ledger: Ledger, year: number): Totals {
  return accumulate(data, ledger, (d) => Number(d.split('-')[0]) === year);
}

// ---------------------------------------------------------------------------
// Caja: ingresos por medio, cierre del día, ganancia neta, proyección.
// Estos reportes son "percibido": se basan en los pagos (fecha real del cobro).
// ---------------------------------------------------------------------------

/** "AÑO-MES0-DIA" → "YYYY-MM-DD" (para cruzar clases con pagos). */
export function dayKeyToISO(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Ingresos agrupados por medio entre dos fechas ISO inclusive. */
export function incomeByMethod(data: AgendaData, fromISO: string, toISO: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pay of Object.values(data.payments)) {
    if (pay.date < fromISO || pay.date > toISO) continue;
    out[pay.methodId] = (out[pay.methodId] ?? 0) + pay.amount;
  }
  return out;
}

export interface CashClose {
  iso: string;
  byMethod: Array<{ methodId: string; label: string; amount: number }>;
  totalCollected: number;
  pending: number;
}

/** Cierre de caja de un día (por clave de día del calendario). */
export function cashClose(data: AgendaData, ledger: Ledger, dayKey: string): CashClose {
  const iso = dayKeyToISO(dayKey);
  const amounts = incomeByMethod(data, iso, iso);
  const byMethod = data.paymentMethods.map((m) => ({
    methodId: m.id,
    label: m.label,
    amount: amounts[m.id] ?? 0,
  }));
  const totalCollected = byMethod.reduce((s, m) => s + m.amount, 0);
  // Pendiente del día: lo que quedó impago de las clases de ese día.
  const pending = dayTotals(data, ledger, dayKey).pending;
  return { iso, byMethod, totalCollected, pending };
}

/**
 * Alumnos que quedaron debiendo por las clases de UN día: monto = lo que le falta pagar a
 * cada alumno en los turnos de ese día (su parte adeudada − lo ya pagado, sin contar lo
 * cubierto por packs). NO calcula nada nuevo: agrega las participaciones que ya trae el
 * `ledger`, así la SUMA de estos montos coincide exactamente con `cashClose().pending`.
 */
export function dayDebtors(
  ledger: Ledger,
  dayKey: string
): Array<{ studentId: string; amount: number }> {
  const byStudent: Record<string, number> = {};
  for (const acc of Object.values(ledger.byStudent)) {
    for (const p of acc.participations) {
      if (p.day !== dayKey || p.coveredByPack) continue;
      const remaining = p.owed - p.paidToward;
      if (remaining > 0.0001) byStudent[p.studentId] = (byStudent[p.studentId] ?? 0) + remaining;
    }
  }
  return Object.entries(byStudent)
    .map(([studentId, amount]) => ({ studentId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Resumen de deuda de un alumno para mostrar al atenderlo: cuánto debe ($) y en cuántas
 * clases (las participaciones impagas, sin contar las cubiertas por pack). Solo LEE el ledger.
 */
export function studentDebt(ledger: Ledger, studentId: string): { amount: number; classes: number } {
  const acc = ledger.byStudent[studentId];
  if (!acc) return { amount: 0, classes: 0 };
  let classes = 0;
  for (const p of acc.participations) {
    if (!p.coveredByPack && p.owed - p.paidToward > 0.0001) classes += 1;
  }
  return { amount: Math.max(0, acc.balance), classes };
}

/**
 * Alumnos que quedaron debiendo por las clases de un MES (year, month 0-indexado): monto =
 * lo que les falta pagar de esas clases. Deriva del ledger (mismos números que la Caja), no
 * calcula plata nueva. Ordenados de mayor a menor deuda.
 */
export function monthDebtors(
  ledger: Ledger,
  year: number,
  month: number
): Array<{ studentId: string; amount: number }> {
  const byStudent: Record<string, number> = {};
  for (const acc of Object.values(ledger.byStudent)) {
    for (const p of acc.participations) {
      if (p.coveredByPack) continue;
      const [y, m] = p.day.split('-').map(Number); // "AÑO-MES0-DIA"
      if (y !== year || m !== month) continue;
      const remaining = p.owed - p.paidToward;
      if (remaining > 0.0001) byStudent[p.studentId] = (byStudent[p.studentId] ?? 0) + remaining;
    }
  }
  return Object.entries(byStudent)
    .map(([studentId, amount]) => ({ studentId, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export interface Profit {
  income: number;
  expenses: number;
  net: number;
}

function inPeriod(iso: string, year: number, month?: number): boolean {
  const [y, m] = iso.split('-').map(Number);
  if (y !== year) return false;
  if (month != null && m !== month + 1) return false; // month es 0-indexado
  return true;
}

/** Ganancia neta (ingresos cobrados − gastos) por año, o por mes si se pasa. */
export function netProfit(data: AgendaData, year: number, month?: number): Profit {
  let income = 0;
  for (const pay of Object.values(data.payments)) {
    if (inPeriod(pay.date, year, month)) income += pay.amount;
  }
  let expenses = 0;
  for (const e of Object.values(data.expenses)) {
    if (inPeriod(e.date, year, month)) expenses += e.amount;
  }
  return { income, expenses, net: income - expenses };
}

/** Gastos de un período, ordenados por fecha descendente. */
export function expensesInPeriod(data: AgendaData, year: number, month?: number): Expense[] {
  return Object.values(data.expenses)
    .filter((e) => inPeriod(e.date, year, month))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Proyección del mes: según lo agendado, cuánto se va a facturar (total),
 * cuánto ya está cobrado y cuánto queda pendiente.
 */
export function monthProjection(data: AgendaData, ledger: Ledger, year: number, month: number): Totals {
  return monthTotals(data, ledger, year, month);
}

/** Pagos de un alumno ordenados por fecha descendente (para su historial). */
export function studentPayments(data: AgendaData, studentId: string): Payment[] {
  return Object.values(data.payments)
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Packs de un alumno con su estado (restantes, avisos). */
export function studentPacks(ledger: Ledger, studentId: string): PackStatus[] {
  return Object.values(ledger.packs)
    .filter((st) => st.pack.studentId === studentId)
    .sort((a, b) => a.pack.purchaseDate.localeCompare(b.pack.purchaseDate));
}
