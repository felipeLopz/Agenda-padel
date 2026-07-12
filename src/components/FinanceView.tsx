import { useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { useDialog } from '../state/DialogContext';
import { MONTH_NAMES } from '../lib/constants';
import { formatCurrency } from '../lib/format';
import { displayName } from '../lib/students';
import CountUp from './CountUp';
import { useSlideDirection } from '../hooks/useSlideDirection';
import {
  incomeByMethod,
  monthProjection,
  netProfit,
  expensesInPeriod,
  monthDebtors,
} from '../lib/money';
import type { Expense } from '../types';
import ExpenseFormModal from './ExpenseFormModal';
import CashCloseModal from './CashCloseModal';

interface FinanceViewProps {
  onOpenStudent: (studentId: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Sección "Caja": proyección, ganancia neta, ingresos por medio, deudores y gastos. */
export default function FinanceView({ onOpenStudent }: FinanceViewProps) {
  const { data, ledger, deleteExpense } = useAgenda();
  const dialog = useDialog();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [expenseModal, setExpenseModal] = useState<{ expense: Expense | null } | null>(null);
  const [cashOpen, setCashOpen] = useState(false);

  const projection = monthProjection(data, ledger, year, month);
  const profitMonth = netProfit(data, year, month);
  const profitYear = netProfit(data, year);
  const fromISO = `${year}-${pad2(month + 1)}-01`;
  const toISO = `${year}-${pad2(month + 1)}-31`;
  const income = incomeByMethod(data, fromISO, toISO);
  const monthExpenses = expensesInPeriod(data, year, month);
  // Alumnos que no pagaron las clases de ESTE mes (deriva del ledger, mismos números).
  const monthOwers = monthDebtors(ledger, year, month);
  const slideDir = useSlideDirection(year * 12 + month);

  return (
    <div className="finance-view">
      <div className="finance-view__toolbar">
        <div className="app-header__year">
          <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Año anterior">
            ←
          </button>
          <span className="app-header__year-label">{year}</span>
          <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Año siguiente">
            →
          </button>
        </div>
        <select className="select" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
        <button className="btn btn--ghost" onClick={() => setCashOpen(true)}>
          Cierre de caja
        </button>
      </div>

      <div className={`finance-grid period-slide period-slide--${slideDir}`} key={`${year}-${month}`}>
        {/* Proyección del mes */}
        <section className="finance-card">
          <h3>Proyección del mes</h3>
          <div className="finance-stat">
            <span>Facturación agendada</span>
            <strong>
              <CountUp value={projection.total} format={formatCurrency} />
            </strong>
          </div>
          <div className="finance-stat">
            <span className="text-paid">Ya cobrado</span>
            <strong className="text-paid">
              <CountUp value={projection.collected} format={formatCurrency} />
            </strong>
          </div>
          <div className="finance-stat">
            <span className="text-pending">Pendiente</span>
            <strong className="text-pending">
              <CountUp value={projection.pending} format={formatCurrency} />
            </strong>
          </div>
        </section>

        {/* Ganancia neta */}
        <section className="finance-card">
          <h3>Ganancia neta</h3>
          <div className="finance-stat">
            <span>Ingresos ({MONTH_NAMES[month]})</span>
            <strong className="text-paid">
              <CountUp value={profitMonth.income} format={formatCurrency} />
            </strong>
          </div>
          <div className="finance-stat">
            <span>Gastos ({MONTH_NAMES[month]})</span>
            <strong className="text-pending">
              <CountUp value={profitMonth.expenses} format={formatCurrency} />
            </strong>
          </div>
          <div className="finance-stat finance-stat--strong">
            <span>Neto del mes</span>
            <strong>
              <CountUp value={profitMonth.net} format={formatCurrency} />
            </strong>
          </div>
          <div className="finance-stat finance-stat--strong">
            <span>Neto del año {year}</span>
            <strong>
              <CountUp value={profitYear.net} format={formatCurrency} />
            </strong>
          </div>
        </section>

        {/* Ingresos por medio */}
        <section className="finance-card">
          <h3>Ingresos por medio ({MONTH_NAMES[month]})</h3>
          {data.paymentMethods.map((m) => (
            <div key={m.id} className="finance-stat">
              <span>{m.label}</span>
              <strong>{formatCurrency(income[m.id] ?? 0)}</strong>
            </div>
          ))}
        </section>

        {/* Ranking de deudores (global) */}
        <section className="finance-card">
          <h3>Deudores</h3>
          <div className="finance-stat finance-stat--strong">
            <span>Total adeudado</span>
            <strong className="text-pending">
              <CountUp value={ledger.totalOwed} format={formatCurrency} />
            </strong>
          </div>
          <div className="debtors-list">
            {ledger.debtors.map((d) => {
              const student = data.students[d.studentId];
              return (
                <button key={d.studentId} className="debtor-row" onClick={() => onOpenStudent(d.studentId)}>
                  <span>{student ? displayName(student) : 'Alumno'}</span>
                  <span className="text-pending">{formatCurrency(d.balance)}</span>
                </button>
              );
            })}
            {ledger.debtors.length === 0 && <p className="search-empty">Nadie debe plata. 🎉</p>}
          </div>
        </section>

        {/* Deudores del mes: quiénes no pagaron las clases de este mes (mismos números que la caja). */}
        <section className="finance-card">
          <h3>No pagaron ({MONTH_NAMES[month]})</h3>
          <div className="finance-stat finance-stat--strong">
            <span>Pendiente del mes</span>
            <strong className="text-pending">{formatCurrency(monthOwers.reduce((s, d) => s + d.amount, 0))}</strong>
          </div>
          <div className="debtors-list">
            {monthOwers.map((d) => {
              const student = data.students[d.studentId];
              return (
                <button key={d.studentId} className="debtor-row" onClick={() => onOpenStudent(d.studentId)}>
                  <span>{student ? displayName(student) : 'Alumno'}</span>
                  <span className="text-pending">{formatCurrency(d.amount)}</span>
                </button>
              );
            })}
            {monthOwers.length === 0 && <p className="search-empty">Todos al día este mes. 🎉</p>}
          </div>
        </section>

        {/* Gastos del mes */}
        <section className="finance-card finance-card--wide">
          <div className="finance-card__head">
            <h3>Gastos ({MONTH_NAMES[month]})</h3>
            <button className="btn btn--small btn--primary" onClick={() => setExpenseModal({ expense: null })}>
              + Nuevo gasto
            </button>
          </div>
          <div className="expenses-list">
            {monthExpenses.map((e) => (
              <div key={e.id} className="expense-row">
                <span className="expense-row__date">{e.date.split('-').reverse().join('/')}</span>
                <span className="expense-row__concept">{e.concept}</span>
                <span className="expense-row__amount">{formatCurrency(e.amount)}</span>
                <button
                  className="icon-btn"
                  onClick={() => setExpenseModal({ expense: e })}
                  aria-label="Editar gasto"
                >
                  ✎
                </button>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={async () => {
                    if (await dialog.confirm('¿Borrar este gasto?', { danger: true, confirmLabel: 'Borrar' }))
                      deleteExpense(e.id);
                  }}
                  aria-label="Borrar gasto"
                >
                  🗑
                </button>
              </div>
            ))}
            {monthExpenses.length === 0 && <p className="search-empty">Sin gastos este mes.</p>}
          </div>
        </section>
      </div>

      {expenseModal && (
        <ExpenseFormModal expense={expenseModal.expense} onClose={() => setExpenseModal(null)} />
      )}
      {cashOpen && <CashCloseModal onClose={() => setCashOpen(false)} />}
    </div>
  );
}
