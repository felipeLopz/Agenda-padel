import { useState } from 'react';
import { useAgenda } from '../state/AgendaContext';
import { MONTH_NAMES, HOURS } from '../lib/constants';
import { formatCurrency } from '../lib/format';
import { displayName } from '../lib/students';
import {
  computeStats,
  monthlyClasses,
  monthlyIncome,
  periodComparison,
  yearsWithData,
  type Comparison,
  type Period,
} from '../lib/stats';
import { downloadReportCSV, downloadReportPDF } from '../lib/report';
import { HBarChart, LineChart, Donut } from './Charts';

interface StatsViewProps {
  /** Ir a la pestaña Caja (para el ranking de deudores completo). */
  onGoCaja: () => void;
}

const MONTH_ABBR = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Muestra la variación vs el período anterior. */
function Delta({ cmp }: { cmp: Comparison }) {
  if (cmp.deltaPct == null) return <span className="delta delta--none">— s/ período previo</span>;
  const up = cmp.deltaPct >= 0;
  return (
    <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
      {up ? '▲' : '▼'} {Math.abs(cmp.deltaPct).toFixed(0)}% vs anterior
    </span>
  );
}

/** Sección "Estadísticas": métricas del período elegido con gráficos y export. */
export default function StatsView({ onGoCaja }: StatsViewProps) {
  const { data, ledger } = useAgenda();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | null>(null); // null = todo el año

  const period: Period = { year, month };
  const st = computeStats(data, ledger, period);
  const cmp = periodComparison(data, ledger, period);
  const income = monthlyIncome(data, ledger, year);
  const classesByMonth = monthlyClasses(data, ledger, year);
  const years = yearsWithData(data);

  const hourItems = HOURS.map((h, i) => ({ label: `${h}:00`, value: st.byHour[i] }));
  const attendanceItems = st.attendance.slice(0, 10).map((a) => ({
    label: data.students[a.studentId] ? displayName(data.students[a.studentId]) : 'Alumno',
    value: a.count,
    color: 'var(--orange)',
  }));

  return (
    <div className="stats-view">
      <div className="stats-view__toolbar">
        <div className="app-header__year">
          <button className="icon-btn" onClick={() => setYear(year - 1)} aria-label="Año anterior">
            ←
          </button>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button className="icon-btn" onClick={() => setYear(year + 1)} aria-label="Año siguiente">
            →
          </button>
        </div>
        <select
          className="select"
          value={month == null ? 'all' : month}
          onChange={(e) => setMonth(e.target.value === 'all' ? null : Number(e.target.value))}
        >
          <option value="all">Todo el año</option>
          {MONTH_NAMES.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
        <div className="stats-view__export">
          <button className="btn btn--ghost btn--small" onClick={() => downloadReportCSV(data, ledger, period)}>
            ⬇ CSV
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => downloadReportPDF(data, ledger, period)}>
            ⬇ PDF
          </button>
        </div>
      </div>

      {/* Tarjetas de titulares con comparación. */}
      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-card__label">Clases</span>
          <span className="stat-card__value">{st.totals.classes}</span>
          <Delta cmp={cmp.classes} />
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Cobrado</span>
          <span className="stat-card__value text-paid">{formatCurrency(st.totals.collected)}</span>
          <Delta cmp={cmp.income} />
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Pendiente</span>
          <span className="stat-card__value text-pending">{formatCurrency(st.totals.pending)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Ocupación</span>
          <span className="stat-card__value">{(st.occupancy.rate * 100).toFixed(1)}%</span>
          <span className="delta delta--none">
            {st.occupancy.used}/{st.occupancy.available} franjas
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Prom. x grupal</span>
          <span className="stat-card__value">{st.avgGroupSize.toFixed(1)}</span>
          <span className="delta delta--none">alumnos por clase</span>
        </div>
      </div>

      <div className="stats-grid">
        {/* Grupal vs individual */}
        <section className="finance-card">
          <h3>Grupales vs individuales</h3>
          <Donut
            segments={[
              { label: 'Grupales', value: st.byTypeCount.grupal, color: 'var(--blue)' },
              { label: 'Individuales', value: st.byTypeCount.indiv, color: 'var(--orange)' },
            ]}
            centerLabel={`${st.totals.classes}`}
          />
        </section>

        {/* Ingresos por tipo */}
        <section className="finance-card">
          <h3>Ingresos por tipo</h3>
          <HBarChart
            items={[
              { label: 'Grupal', value: Math.round(st.incomeByType.grupal), color: 'var(--blue)' },
              { label: 'Individual', value: Math.round(st.incomeByType.indiv), color: 'var(--orange)' },
            ]}
            formatValue={formatCurrency}
          />
        </section>

        {/* Franjas más y menos ocupadas */}
        <section className="finance-card">
          <h3>Franjas más usadas</h3>
          <HBarChart items={hourItems} />
        </section>

        {/* Ranking de asistencia */}
        <section className="finance-card">
          <h3>Alumnos que más vienen</h3>
          <HBarChart items={attendanceItems} />
        </section>

        {/* Ingresos mes a mes */}
        <section className="finance-card finance-card--wide">
          <h3>Ingresos mes a mes ({year})</h3>
          <LineChart values={income} labels={MONTH_ABBR} formatValue={formatCurrency} />
        </section>

        {/* Clases mes a mes */}
        <section className="finance-card finance-card--wide">
          <h3>Clases mes a mes ({year})</h3>
          <LineChart values={classesByMonth} labels={MONTH_ABBR} />
        </section>

        {/* Deudores → enlace a Caja (no se duplica) */}
        <section className="finance-card">
          <h3>Deudores</h3>
          <div className="finance-stat finance-stat--strong">
            <span>Total adeudado</span>
            <strong className="text-pending">{formatCurrency(ledger.totalOwed)}</strong>
          </div>
          <div className="finance-stat">
            <span>Alumnos que deben</span>
            <strong>{ledger.debtors.length}</strong>
          </div>
          <button className="btn btn--ghost btn--small" onClick={onGoCaja}>
            Ver ranking en Caja →
          </button>
        </section>
      </div>
    </div>
  );
}
