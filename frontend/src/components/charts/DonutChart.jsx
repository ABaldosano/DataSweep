import "./charts.css";

// segments: [{ label, value, color }]
export default function DonutChart({ segments, size = 132, thickness = 16, centerLabel, centerSub }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((s) => {
              if (s.value <= 0) return null;
              const frac = s.value / total;
              const dash = frac * circumference;
              const circle = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
        </g>
        <text x="50%" y="47%" textAnchor="middle" className="donut-center-value">
          {centerLabel}
        </text>
        {centerSub && (
          <text x="50%" y="62%" textAnchor="middle" className="donut-center-sub">
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="donut-legend">
        {segments.map((s) => (
          <li key={s.label}>
            <span className="donut-swatch" style={{ background: s.color }} />
            {s.label}
            <span className="dim"> {s.value.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
