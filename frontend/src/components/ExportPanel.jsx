import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import "./ExportPanel.css";

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Stat({ label, before, after, goodDirection = "down" }) {
  const changed = before !== after;
  const improved = goodDirection === "down" ? after < before : after > before;

  return (
    <div className="export-stat">
      <span className="export-stat-label">{label}</span>
      <span className="export-stat-value">
        {before === null ? "N/A" : before.toLocaleString()}
        <span className="dim"> → </span>
        <span className={changed ? (improved ? "good" : "warn") : "dim"}>{after.toLocaleString()}</span>
      </span>
    </div>
  );
}

function TableExportCard({ table }) {
  const [report, setReport] = useState(null);
  const [downloading, setDownloading] = useState(null); // 'csv' | 'sql' | null

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/export/${table.name}/report`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
  }, [table.name, table.rowCount]);

  async function download(format) {
    setDownloading(format);
    const res = await apiFetch(`/api/export/${table.name}/${format}`);
    const blob = await res.blob();
    triggerDownload(blob, `${table.name}_cleaned.${format}`);
    setDownloading(null);
  }

  return (
    <div className="export-table-card">
      <div className="export-table-header">
        <span className="schema-table-name">{table.name}</span>
        <div className="export-buttons">
          <button className="clean-btn" onClick={() => download("csv")} disabled={downloading === "csv"}>
            {downloading === "csv" ? "Preparing…" : "Download .csv"}
          </button>
          <button className="clean-btn" onClick={() => download("sql")} disabled={downloading === "sql"}>
            {downloading === "sql" ? "Preparing…" : "Download .sql"}
          </button>
        </div>
      </div>

      {report && report.originalRowCount !== null && (
        <div className="export-report">
          <Stat label="Rows" before={report.originalRowCount} after={report.currentRowCount} />
          <Stat label="Null values" before={report.originalNullCount} after={report.currentNullCount} />
          <Stat label="Duplicate rows" before={report.originalDuplicateRows} after={report.currentDuplicateRows} />
        </div>
      )}
    </div>
  );
}

export default function ExportPanel({ tables, status }) {
  if (status === "empty") {
    return <p className="profile-empty">Upload a file above to enable export.</p>;
  }

  return (
    <div className="clean-list">
      {tables.map((table) => (
        <TableExportCard key={table.name} table={table} />
      ))}
    </div>
  );
}
