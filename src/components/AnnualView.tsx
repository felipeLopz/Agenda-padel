import { useAgenda } from '../state/AgendaContext';
import { MONTH_NAMES } from '../lib/constants';
import { formatCurrency } from '../lib/format';
import { yearTotals } from '../lib/money';
import MonthColumn from './MonthColumn';
import CountUp from './CountUp';

interface AnnualViewProps {
  year: number;
  onOpenDay: (day: string) => void;
}

/** Vista principal: los 12 meses del año como columnas, con totales arriba y al pie. */
export default function AnnualView({ year, onOpenDay }: AnnualViewProps) {
  const { data, ledger } = useAgenda();
  const totals = yearTotals(data, ledger, year);

  return (
    <div className="annual-view">
      <div className="year-summary">
        <div className="year-summary__item">
          <span className="year-summary__label">Clases</span>
          <span className="year-summary__value">
            <CountUp value={totals.classes} />
          </span>
        </div>
        <div className="year-summary__item">
          <span className="year-summary__label">Alumnos atendidos</span>
          <span className="year-summary__value">
            <CountUp value={totals.students} />
          </span>
        </div>
        <div className="year-summary__item">
          <span className="year-summary__label">Cobrado</span>
          <span className="year-summary__value year-summary__value--paid">
            <CountUp value={totals.collected} format={formatCurrency} />
          </span>
        </div>
        <div className="year-summary__item">
          <span className="year-summary__label">Pendiente</span>
          <span className="year-summary__value year-summary__value--pending">
            <CountUp value={totals.pending} format={formatCurrency} />
          </span>
        </div>
        <div className="year-summary__item">
          <span className="year-summary__label">Total</span>
          <span className="year-summary__value">
            <CountUp value={totals.total} format={formatCurrency} />
          </span>
        </div>
      </div>

      <div className="annual-view__months">
        {MONTH_NAMES.map((name, month) => (
          <MonthColumn key={month} year={year} month={month} name={name} onOpenDay={onOpenDay} />
        ))}
      </div>
    </div>
  );
}
