// Exportación de reportes de estadísticas: CSV (abre en Excel) y PDF (jsPDF con
// import() diferido, igual que los recibos). Toma las métricas ya calculadas.

import type { jsPDF } from 'jspdf';
import type { AgendaData } from '../types';
import { MONTH_NAMES } from './constants';
import { formatCurrency } from './format';
import { displayName } from './students';
import type { Ledger } from './money';
import { computeStats, monthlyIncome, periodComparison, type Period } from './stats';

/** Etiqueta legible del período. */
export function periodLabel(period: Period): string {
  return period.month != null ? `${MONTH_NAMES[period.month]} ${period.year}` : `Año ${period.year}`;
}

function resolveName(data: AgendaData, studentId: string): string {
  const s = data.students[studentId];
  return s ? displayName(s) : 'Alumno';
}

/** Nombre de archivo base para los reportes. */
function fileBase(period: Period): string {
  const p = period.month != null ? `${period.year}-${String(period.month + 1).padStart(2, '0')}` : `${period.year}`;
  return `reporte-padel-${p}`;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Escapa un campo para CSV con delimitador ';'. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(';');
}

/** Arma el contenido CSV del reporte del período. */
export function buildReportCSV(data: AgendaData, ledger: Ledger, period: Period): string {
  const st = computeStats(data, ledger, period);
  const cmp = periodComparison(data, ledger, period);
  const rows: string[] = [];

  // "sep=;" ayuda a Excel (Argentina) a detectar el separador.
  rows.push('sep=;');
  rows.push(csvRow(['Reporte', periodLabel(period)]));
  rows.push('');

  rows.push(csvRow(['Métrica', 'Valor']));
  rows.push(csvRow(['Clases', st.totals.classes]));
  rows.push(csvRow(['Alumnos atendidos', st.totals.students]));
  rows.push(csvRow(['Cobrado', Math.round(st.totals.collected)]));
  rows.push(csvRow(['Pendiente', Math.round(st.totals.pending)]));
  rows.push(csvRow(['Facturación total', Math.round(st.totals.total)]));
  rows.push(csvRow(['Clases grupales', st.byTypeCount.grupal]));
  rows.push(csvRow(['Clases dobles', st.byTypeCount.doble]));
  rows.push(csvRow(['Clases individuales', st.byTypeCount.indiv]));
  rows.push(csvRow(['Ingresos grupales', Math.round(st.incomeByType.grupal)]));
  rows.push(csvRow(['Ingresos dobles', Math.round(st.incomeByType.doble)]));
  rows.push(csvRow(['Ingresos individuales', Math.round(st.incomeByType.indiv)]));
  rows.push(csvRow(['Promedio alumnos por grupal', st.avgGroupSize.toFixed(2)]));
  rows.push(csvRow(['Ocupación (franjas usadas)', st.occupancy.used]));
  rows.push(csvRow(['Ocupación (franjas disponibles)', st.occupancy.available]));
  rows.push(csvRow(['Ocupación (%)', (st.occupancy.rate * 100).toFixed(1)]));
  rows.push(csvRow(['Clases canceladas', st.cancelled]));
  rows.push(csvRow(['Clases vs período anterior', cmp.classes.previous]));
  rows.push(csvRow(['Cobrado vs período anterior', Math.round(cmp.income.previous)]));
  rows.push('');

  rows.push(csvRow(['Ranking de asistencia', 'Clases']));
  for (const a of st.attendance) rows.push(csvRow([resolveName(data, a.studentId), a.count]));
  rows.push('');

  rows.push(csvRow(['Deudores', 'Saldo']));
  for (const d of ledger.debtors) rows.push(csvRow([resolveName(data, d.studentId), Math.round(d.balance)]));
  rows.push('');

  // Ingresos mes a mes del año (contexto).
  const monthly = monthlyIncome(data, ledger, period.year);
  rows.push(csvRow(['Mes', `Ingresos ${period.year}`]));
  monthly.forEach((v, m) => rows.push(csvRow([MONTH_NAMES[m], Math.round(v)])));

  return rows.join('\n');
}

/** Descarga el reporte como archivo CSV. */
export function downloadReportCSV(data: AgendaData, ledger: Ledger, period: Period): void {
  const csv = buildReportCSV(data, ledger, period);
  // BOM para que Excel respete los acentos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase(period)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function buildReportPDF(data: AgendaData, ledger: Ledger, period: Period): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const st = computeStats(data, ledger, period);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  let y = 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Agenda de Pádel — Reporte', left, y);
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel(period), left, y);
  y += 4;
  doc.setDrawColor(180);
  doc.line(left, y, 190, y);
  y += 10;

  const line = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, left + 70, y);
    y += 7;
  };

  line('Clases', String(st.totals.classes));
  line('Alumnos atendidos', String(st.totals.students));
  line('Cobrado', formatCurrency(st.totals.collected));
  line('Pendiente', formatCurrency(st.totals.pending));
  line('Facturación total', formatCurrency(st.totals.total));
  line('Grupales / Dobles / Indiv.', `${st.byTypeCount.grupal} / ${st.byTypeCount.doble} / ${st.byTypeCount.indiv}`);
  line(
    'Ingresos grup / dob / indiv',
    `${formatCurrency(st.incomeByType.grupal)} / ${formatCurrency(st.incomeByType.doble)} / ${formatCurrency(st.incomeByType.indiv)}`
  );
  line('Prom. alumnos por grupal', st.avgGroupSize.toFixed(2));
  line('Ocupación', `${st.occupancy.used}/${st.occupancy.available} franjas (${(st.occupancy.rate * 100).toFixed(1)}%)`);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Ranking de asistencia', left, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  for (const a of st.attendance.slice(0, 10)) {
    doc.text(`${resolveName(data, a.studentId)} — ${a.count} clases`, left, y);
    y += 6;
    if (y > 270) break;
  }

  if (ledger.debtors.length > 0 && y < 250) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Deudores', left, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    for (const d of ledger.debtors.slice(0, 10)) {
      doc.text(`${resolveName(data, d.studentId)} — ${formatCurrency(d.balance)}`, left, y);
      y += 6;
      if (y > 285) break;
    }
  }

  return doc;
}

/** Descarga el reporte del período como PDF. */
export async function downloadReportPDF(data: AgendaData, ledger: Ledger, period: Period): Promise<void> {
  const doc = await buildReportPDF(data, ledger, period);
  doc.save(`${fileBase(period)}.pdf`);
}
