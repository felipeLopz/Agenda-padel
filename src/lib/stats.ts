// Estadísticas y reportes (v5). Funciones puras que LEEN los datos existentes
// (clases, participantes, estados) y el ledger de plata; no cambian nada.
//
// Criterio de "ingresos": se usa lo COBRADO sobre las clases del período
// (ledger.byClass.collected), el mismo criterio que la barra anual, para que los
// números coincidan con lo que ya se ve en la app. Las clases canceladas no cuentan.

import type { AgendaData, ClassType } from '../types';
import { parseDayKey } from './date';
import { isChargeable } from './classMeta';
import { classKey, monthTotals, yearTotals, type Ledger, type Totals } from './money';
import {
  countWorkdaysInPeriod,
  endHour,
  isWorkday,
  scheduleHours,
  slotsPerDay,
  startHour,
} from './schedule';

/** Período de análisis: un mes (month 0-indexado) o todo el año (month = null). */
export interface Period {
  year: number;
  month: number | null;
}

/** ¿La clave de día cae en el período? (day = "AÑO-MES0-DIA"). */
function dayInPeriod(day: string, period: Period): boolean {
  const [y, m] = day.split('-').map(Number);
  if (y !== period.year) return false;
  if (period.month != null && m !== period.month) return false;
  return true;
}

/** Totales del período usando las funciones de money (mes o año). */
export function periodTotals(data: AgendaData, ledger: Ledger, period: Period): Totals {
  return period.month != null
    ? monthTotals(data, ledger, period.year, period.month)
    : yearTotals(data, ledger, period.year);
}

/** Período inmediatamente anterior (mes anterior, o año anterior). */
export function previousPeriod(period: Period): Period {
  if (period.month != null) {
    const m = period.month - 1;
    return m < 0 ? { year: period.year - 1, month: 11 } : { year: period.year, month: m };
  }
  return { year: period.year - 1, month: null };
}

export interface StatsSummary {
  /** clases, alumnos atendidos, cobrado, pendiente, total (facturación). */
  totals: Totals;
  /** Cantidad de clases por tipo (no canceladas). */
  byTypeCount: Record<ClassType, number>;
  /** Cobrado atribuido a cada tipo de clase. */
  incomeByType: Record<ClassType, number>;
  /** Cantidad de clases por franja horaria (horario configurado + horas con clase). */
  byHour: Array<{ hour: number; count: number }>;
  /** Ranking de asistencia: alumnos con más clases (no canceladas). */
  attendance: Array<{ studentId: string; count: number }>;
  /** Promedio de alumnos por clase grupal. */
  avgGroupSize: number;
  /** Tasa de ocupación: franjas usadas / disponibles. */
  occupancy: { used: number; available: number; rate: number };
  /** Clases canceladas en el período (informativo). */
  cancelled: number;
}

/**
 * Calcula todas las métricas del período en una sola pasada sobre los días.
 */
export function computeStats(data: AgendaData, ledger: Ledger, period: Period): StatsSummary {
  const totals = periodTotals(data, ledger, period);

  const settings = data.settings;
  const byTypeCount: Record<ClassType, number> = { grupal: 0, indiv: 0 };
  const incomeByType: Record<ClassType, number> = { grupal: 0, indiv: 0 };
  // Contador por hora: se siembra con el horario configurado y se agregan las horas
  // con clase que caigan fuera de ese rango (para no esconder ninguna).
  const byHourMap = new Map<number, number>();
  for (const h of scheduleHours(settings)) byHourMap.set(h, 0);
  const attendanceMap = new Map<string, number>();
  let groupSizeSum = 0;
  let groupClasses = 0;
  let cancelled = 0;

  for (const [day, slots] of Object.entries(data.days)) {
    if (!dayInPeriod(day, period)) continue;
    for (const [hourStr, entry] of Object.entries(slots)) {
      if (!isChargeable(entry)) {
        cancelled += 1;
        continue;
      }
      const hour = Number(hourStr);
      byTypeCount[entry.type] += 1;
      byHourMap.set(hour, (byHourMap.get(hour) ?? 0) + 1);
      const acc = ledger.byClass[classKey(day, hour)];
      if (acc) incomeByType[entry.type] += acc.collected;
      for (const p of entry.participants) {
        if (p.studentId) attendanceMap.set(p.studentId, (attendanceMap.get(p.studentId) ?? 0) + 1);
      }
      if (entry.type === 'grupal') {
        groupSizeSum += entry.participants.length;
        groupClasses += 1;
      }
    }
  }

  const byHour = [...byHourMap.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

  const attendance = [...attendanceMap.entries()]
    .map(([studentId, count]) => ({ studentId, count }))
    .sort((a, b) => b.count - a.count);

  const used = byTypeCount.grupal + byTypeCount.indiv;

  // Franjas disponibles = días LABORALES del período × franjas por día − bloqueos.
  // Solo se descuentan bloqueos que caen en días laborales y dentro del horario.
  const workdays = countWorkdaysInPeriod(settings, period.year, period.month);
  const perDay = slotsPerDay(settings);
  const sh = startHour(settings);
  const eh = endHour(settings);
  let blockedSlots = 0;
  for (const [day, block] of Object.entries(data.blocks)) {
    if (!dayInPeriod(day, period)) continue;
    if (!isWorkday(settings, parseDayKey(day))) continue;
    blockedSlots += block.fullDay ? perDay : (block.hours ?? []).filter((h) => h >= sh && h <= eh).length;
  }
  const available = Math.max(0, workdays * perDay - blockedSlots);
  const rate = available > 0 ? used / available : 0;

  return {
    totals,
    byTypeCount,
    incomeByType,
    byHour,
    attendance,
    avgGroupSize: groupClasses ? groupSizeSum / groupClasses : 0,
    occupancy: { used, available, rate },
    cancelled,
  };
}

/** Cobrado por mes del año (índice 0 = enero), para el gráfico de ingresos. */
export function monthlyIncome(data: AgendaData, ledger: Ledger, year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => monthTotals(data, ledger, year, m).collected);
}

/** Clases por mes del año (índice 0 = enero). */
export function monthlyClasses(data: AgendaData, ledger: Ledger, year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => monthTotals(data, ledger, year, m).classes);
}

export interface Comparison {
  current: number;
  previous: number;
  /** Variación porcentual respecto del período anterior (o null si el anterior es 0). */
  deltaPct: number | null;
}

function makeComparison(current: number, previous: number): Comparison {
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, deltaPct };
}

/** Compara clases e ingresos del período con el período anterior. */
export function periodComparison(
  data: AgendaData,
  ledger: Ledger,
  period: Period
): { classes: Comparison; income: Comparison } {
  const cur = periodTotals(data, ledger, period);
  const prev = periodTotals(data, ledger, previousPeriod(period));
  return {
    classes: makeComparison(cur.classes, prev.classes),
    income: makeComparison(cur.collected, prev.collected),
  };
}

/** Años que tienen alguna clase cargada (para el selector de período). */
export function yearsWithData(data: AgendaData): number[] {
  const years = new Set<number>();
  for (const day of Object.keys(data.days)) years.add(Number(day.split('-')[0]));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}
