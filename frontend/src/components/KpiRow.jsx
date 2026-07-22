import { formatCurrency, formatNumber } from "../utils/data";
import "./KpiRow.css";

export default function KpiRow({ kpi }) {
  const items = [
    { label: "Total Revenue", value: formatCurrency(kpi.total_revenue) },
    { label: "Total Orders", value: formatNumber(kpi.total_orders) },
    { label: "Avg. Order Value", value: formatCurrency(kpi.avg_order_value) },
    { label: "Avg. Rating", value: `${kpi.avg_rating.toFixed(1)} / 10` },
  ];

  return (
    <div className="kpi-row" role="list">
      {items.map((item, i) => (
        <div className="kpi-card" role="listitem" key={item.label}>
          <span className="kpi-index">{String(i + 1).padStart(2, "0")}</span>
          <span className="kpi-label">{item.label}</span>
          <span className="kpi-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
