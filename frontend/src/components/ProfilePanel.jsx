import "./ProfilePanel.css";

function formatValue(v) {
  if (v === null || v === undefined) return "N/A";
  if (typeof v === "number") return v.toLocaleString();
  const s = String(v);
  return s.length > 18 ? `${s.slice(0, 18)}…` : s;
}

export default function ProfilePanel({ tables, status }) {
  if (status === "empty") {
    return <p className="profile-empty">Upload a file above to see column-level stats here.</p>;
  }

  if (status === "loading") {
    return <p className="profile-empty">Profiling columns…</p>;
  }

  if (status === "error") {
    return <p className="profile-empty">Couldn't load the profile. Try re-uploading.</p>;
  }

  return (
    <div className="profile-list">
      {tables.map((table) => (
        <div className="profile-table" key={table.name}>
          <div className="profile-table-header">
            <span className="schema-table-name">{table.name}</span>
            <span className="schema-table-rows">{table.rowCount.toLocaleString()} rows</span>
          </div>
          <div className="profile-table-wrap">
            <table className="profile-stats-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Type</th>
                  <th>Nulls</th>
                  <th>Unique</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Avg</th>
                  <th>Samples</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => (
                  <tr key={col.name}>
                    <td className="col-name">{col.name}</td>
                    <td>
                      <span className={`type-badge type-${col.type.toLowerCase()}`}>{col.type}</span>
                    </td>
                    <td className={col.nullCount > 0 ? "warn" : "dim"}>
                      {col.nullCount} <span className="dim">({col.nullPct}%)</span>
                    </td>
                    <td>{col.uniqueCount.toLocaleString()}</td>
                    <td className="dim">{formatValue(col.min)}</td>
                    <td className="dim">{formatValue(col.max)}</td>
                    <td className="dim">{formatValue(col.avg)}</td>
                    <td className="samples dim">
                      {col.sampleValues.map((v) => formatValue(v)).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
