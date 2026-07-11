// Generación de recibos en PDF con jsPDF (archivo real, descargable y compartible).
// jsPDF se carga con import() dinámico para no engordar el bundle inicial: solo
// se descarga la primera vez que se genera un recibo.

import type { jsPDF } from 'jspdf';
import type { Payment, Student } from '../types';
import { displayName } from './students';
import { formatCurrency } from './format';

/** "YYYY-MM-DD" → "DD/MM/YYYY" para el recibo. */
function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

interface ReceiptData {
  payment: Payment;
  student: Student;
  methodLabel: string;
  /** Nombre de la tienda/profesor para el encabezado. */
  businessName?: string;
}

/** Arma el PDF del recibo en memoria y devuelve el documento jsPDF. */
async function buildReceipt({
  payment,
  student,
  methodLabel,
  businessName = 'Agenda de Pádel',
}: ReceiptData): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  let y = 24;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, left, y);

  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('RECIBO DE PAGO', left, y);

  y += 4;
  doc.setDrawColor(180);
  doc.line(left, y, 190, y);

  const rows: Array<[string, string]> = [
    ['Fecha', isoToDisplay(payment.date)],
    ['Alumno', displayName(student)],
    ['Concepto', payment.concept || (payment.kind === 'pack' ? 'Compra de pack' : 'Pago de clases')],
    ['Medio de pago', methodLabel],
  ];

  y += 12;
  doc.setFontSize(12);
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, left + 40, y);
    y += 9;
  }

  y += 6;
  doc.setDrawColor(180);
  doc.line(left, y, 190, y);
  y += 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Total', left, y);
  doc.text(formatCurrency(payment.amount), 190, y, { align: 'right' });

  y += 20;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text('Comprobante no válido como factura.', left, y);

  return doc;
}

/** Nombre de archivo del recibo. */
function receiptFilename(payment: Payment, student: Student): string {
  const name = displayName(student).replace(/\s+/g, '-').toLowerCase();
  return `recibo-${name}-${payment.date}.pdf`;
}

/** Descarga el recibo como archivo .pdf. */
export async function downloadReceipt(input: ReceiptData): Promise<void> {
  const doc = await buildReceipt(input);
  doc.save(receiptFilename(input.payment, input.student));
}

/**
 * Comparte el recibo con la hoja de compartir del sistema (celular). Si no está
 * disponible compartir archivos, cae a la descarga.
 */
export async function shareReceipt(input: ReceiptData): Promise<void> {
  const doc = await buildReceipt(input);
  const filename = receiptFilename(input.payment, input.student);
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Recibo' });
      return;
    } catch {
      // Si el usuario cancela o falla, caemos a descarga.
    }
  }
  doc.save(filename);
}
