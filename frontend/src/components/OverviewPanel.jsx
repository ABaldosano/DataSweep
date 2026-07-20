import BarChart from "./charts/BarChart";
import DonutChart from "./charts/DonutChart";
import Meter from "./charts/Meter";
import "./OverviewPanel.css";

// Pure presentational aggregation over data App already fetches -- no new
// endpoints, no changed logic, just reshaping what's in state for charts.
export default function OverviewPanel({ tables, profileTables, status }) {
  if (status === "empty") {
    return (
      <p className="profile-empty">
        Upload a .sql or .csv file to populate the overview.
      </p>
    );
  }

  const totalRows = tables.reduce((sum, t) => sum + (t.rowCount || 0), 0);

  let totalCells = 0;
  let totalNulls = 0;
  const nullByColumnType = { numeric: 0, text: 0 };

  profileTables.forEach((table) => {
    table.columns.forEach((col) => {
      totalCells += table.rowCount || 0;
      totalNulls += col.nullCount || 0;
    });
  });

  const completeness = totalCells > 0 ? ((totalCells - totalNulls) / totalCells) * 100 : 100;

  const rowsByTable = tables
    .map((t) => ({ label: t.name, value: t.rowCount || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const nullsByTable = profileTables.map((t) => ({
    label: t.name,
    value: t.columns.reduce((sum, c) => sum + (c.nullCount || 0), 0),
  }));
  const totalNullsForDonut = nullsByTable.reduce((s, t) => s + t.value, 0);
  const palette = ["var(--chart-c1)", "var(--chart-c2)", "var(--chart-c3)", "var(--chart-c4)", "var(--chart-c5)"];
  const donutSegments = nullsByTable
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((t, i) => ({ label: t.label, value: t.value, color: palette[i % palette.length] }));

  const columnCount = tables.reduce((sum, t) => sum + (t.columns?.length || 0), 0);

  return (
    <div className="overview-grid">
      <div className="overview-stat-row">
        <div className="overview-stat-card">
          <span className="overview-stat-label">Tables</span>
          <span className="overview-stat-value">{tables.length}</span>
        </div>
        <div className="overview-stat-card">
          <span className="overview-stat-label">Total rows</span>
          <span className="overview-stat-value">{totalRows.toLocaleString()}</span>
        </div>
        <div className="overview-stat-card">
          <span className="overview-stat-label">Columns</span>
          <span className="overview-stat-value">{columnCount}</span>
        </div>
        <div className="overview-stat-card">
          <span className="overview-stat-label">Null cells</span>
          <span className="overview-stat-value">{totalNulls.toLocaleString()}</span>
        </div>
      </div>

      <div className="overview-panels">
        <div className="overview-card">
          <h3>Rows per table</h3>
          <BarChart data={rowsByTable} color="var(--chart-c1)" />
        </div>

        <div className="overview-card overview-card-center">
          <h3>Data completeness</h3>
          <Meter
            value={completeness}
            label="Non-null cells"
            tone={completeness > 90 ? "good" : completeness > 70 ? "info" : "warn"}
          />
        </div>

        <div className="overview-card">
          <h3>Nulls by table</h3>
          {totalNullsForDonut > 0 ? (
            <DonutChart
              segments={donutSegments}
              centerLabel={totalNullsForDonut.toLocaleString()}
              centerSub="nulls"
            />
          ) : (
            <p className="chart-empty">No nulls detected across tables.</p>
          )}
        </div>
      </div>
    </div>
  );
}
