// Gráficos propios, sin librería: barras (CSS), línea y dona (SVG). Usan la paleta
// del tema vía variables CSS y son responsivos (viewBox / anchos relativos).

interface BarItem {
  label: string;
  value: number;
  /** Color CSS opcional (por defecto azul del tema). */
  color?: string;
}

/** Barras horizontales. Ideal para rankings y franjas horarias. */
export function HBarChart({
  items,
  formatValue = (v) => String(v),
}: {
  items: BarItem[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbar">
      {items.map((it, idx) => (
        <div key={idx} className="hbar__row">
          <span className="hbar__label" title={it.label}>
            {it.label}
          </span>
          <span className="hbar__track">
            <span
              className="hbar__fill"
              style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? 'var(--blue)' }}
            />
          </span>
          <span className="hbar__value">{formatValue(it.value)}</span>
        </div>
      ))}
      {items.length === 0 && <p className="search-empty">Sin datos en el período.</p>}
    </div>
  );
}

/** Gráfico de línea (SVG). Para series mensuales (ej: ingresos mes a mes). */
export function LineChart({
  values,
  labels,
  formatValue = (v) => String(v),
}: {
  values: number[];
  labels: string[];
  formatValue?: (v: number) => string;
}) {
  const W = 320;
  const H = 120;
  const padL = 6;
  const padR = 6;
  const padT = 10;
  const padB = 18;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i * (W - padL - padR)) / (n - 1));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPoints = `${padL},${H - padB} ${points} ${x(n - 1)},${H - padB}`;
  const maxIdx = values.indexOf(Math.max(...values));

  return (
    <svg className="linechart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      <polygon points={areaPoints} fill="var(--blue)" opacity="0.12" />
      <polyline points={points} fill="none" stroke="var(--blue)" strokeWidth="2" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === maxIdx ? 3.2 : 2} fill="var(--blue-light)" />
      ))}
      {/* Valor máximo anotado. */}
      {max > 0 && (
        <text x={x(maxIdx)} y={y(values[maxIdx]) - 5} className="linechart__peak" textAnchor="middle">
          {formatValue(values[maxIdx])}
        </text>
      )}
      {labels.map((lb, i) => (
        <text key={i} x={x(i)} y={H - 5} className="linechart__xlabel" textAnchor="middle">
          {lb}
        </text>
      ))}
    </svg>
  );
}

interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Dona (SVG) con leyenda. Para proporciones (ej: grupal vs individual). */
export function Donut({
  segments,
  centerLabel,
}: {
  segments: Segment[];
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" className="donut__svg" role="img">
        <g transform="translate(60,60) rotate(-90)">
          <circle r={r} fill="none" stroke="var(--bg-card)" strokeWidth="14" />
          {total > 0 &&
            segments.map((seg, idx) => {
              const frac = seg.value / total;
              const dash = frac * c;
              const circle = (
                <circle
                  key={idx}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += dash;
              return circle;
            })}
        </g>
        {centerLabel && (
          <text x="60" y="64" textAnchor="middle" className="donut__center">
            {centerLabel}
          </text>
        )}
      </svg>
      <div className="donut__legend">
        {segments.map((seg, idx) => (
          <div key={idx} className="donut__legend-item">
            <span className="donut__swatch" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <strong>{total > 0 ? Math.round((seg.value / total) * 100) : 0}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
