import { useEffect, useState } from "react";
import BarChart from "./charts/BarChart";
import DonutChart from "./charts/DonutChart";
import Meter from "./charts/Meter";
import TableFilterPanel from "./TableFilterPanel";
import SchemaDiagram from "./SchemaDiagram";
import ERDView from "./ERDView";
import "./OverviewPanel.css";

// Pure presentational aggregation over data App already fetches -- no new
// endpoints, no changed logic, just reshaping what's in state for charts.
// Layout mirrors a filter-rail + multi-chart-grid dashboard: a narrow table
// filter on the left, a row of larger charts, a row of smaller ones, and a
// full-width schema/keys section underneath.
export default function OverviewPanel({ tables, profileTables, status }) {
  const tableNamesKey = tables.map((t) => t.name).join("|");
  const [selected, setSelected] = useState(() => new Set(tables.map((t) => t.name)));

  useEffect(() => {
    setSelected(new Set(tables.map((t) => t.name)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNamesKey]);

  if (status === "empty") {
    return (
      <p className="profile-empty">
        Upload a .sql or .csv file to populate the overview.
      </p>
    );
  }

  function toggleTable(name) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredTables = tables.filter((t) => selected.has(t.name));
  const filteredProfileTables = profileTables.filter((t) => selected.has(t.name));

  const totalRows = filteredTables.reduce((sum, t) => sum + (t.rowCount || 0), 0);

  let totalCells = 0;
  let totalNulls = 0;

  filteredProfileTables.forEach((table) => {
    table.columns.forEach((col) => {
      totalCells += table.rowCount || 0;
      totalNulls += col.nullCount || 0;
    });
  });

  const completeness = totalCells > 0 ? ((totalCells - totalNulls) / totalCells) * 100 : 100;

  const rowsByTable = filteredTables
    .map((t) => ({ label: t.name, value: t.rowCount || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const columnsByTable = filteredTables
    .map((t) => ({ label: t.name, value: t.columns?.length || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const nullsByTable = filteredProfileTables.map((t) => ({
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

  const columnCount = filteredTables.reduce((sum, t) => sum + (t.columns?.length || 0), 0);

  return (
    <div className="overview-dashboard">
      <TableFilterPanel
        tables={tables}
        selected={selected}
        onToggle={toggleTable}
        onSelectAll={() => setSelected(new Set(tables.map((t) => t.name)))}
        onSelectNone={() => setSelected(new Set())}
      />

      <div className="overview-main">
        {selected.size === 0 ? (
          <p className="chart-empty">No tables selected -- check one on the left to populate the dashboard.</p>
        ) : (
          <>
            <div className="overview-row overview-row-top">
              <div className="overview-card overview-card-wide">
                <h3>Rows per table</h3>
                <BarChart data={rowsByTable} color="var(--chart-c1)" />
              </div>
              <div className="overview-card overview-card-wide">
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

            <div className="overview-row overview-row-bottom">
              <div className="overview-card overview-card-center">
                <h3>Data completeness</h3>
                <Meter
                  value={completeness}
                  label="Non-null cells"
                  tone={completeness > 90 ? "good" : completeness > 70 ? "info" : "warn"}
                />
              </div>
              <div className="overview-card">
                <h3>Columns per table</h3>
                <BarChart data={columnsByTable} color="var(--chart-c2)" />
              </div>
              <div className="overview-card overview-card-snapshot">
                <h3>Snapshot</h3>
                <div className="overview-snapshot-list">
                  <div className="overview-snapshot-row">
                    <span>Tables</span>
                    <span>{filteredTables.length}</span>
                  </div>
                  <div className="overview-snapshot-row">
                    <span>Total rows</span>
                    <span>{totalRows.toLocaleString()}</span>
                  </div>
                  <div className="overview-snapshot-row">
                    <span>Columns</span>
                    <span>{columnCount}</span>
                  </div>
                  <div className="overview-snapshot-row">
                    <span>Null cells</span>
                    <span>{totalNulls.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overview-schema-section">
              <h3>Tables &amp; keys</h3>
              <SchemaDiagram tables={filteredProfileTables} />
            </div>

            <div className="overview-schema-section">
              <h3>Entity relationship diagram</h3>
              <ERDView tables={filteredProfileTables} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
