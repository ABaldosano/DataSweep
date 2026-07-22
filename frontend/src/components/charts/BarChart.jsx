import "./charts.css";

// Horizontal bar chart for comparing a metric across tables.
export default function BarChart({ data, valueKey = "value", labelKey = "label", color = "var(--accent-data)", unit = "" }) {
  if (!data || data.length === 0) {
    return <p className="chart-empty">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d[valueKey]), 1);

  return (
    <div className="bar-chart" role="img" aria-label="Bar chart">
      {data.map((d) => {
        const pct = (d[valueKey] / max) * 100;
        return (
          <div className="bar-chart-row" key={d[labelKey]}>
            <span className="bar-chart-label">{d[labelKey]}</span>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ width: `${pct}%`, background: d.color || color }}
              />
            </div>
            <span className="bar-chart-value">
              {d[valueKey].toLocaleString()}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}
