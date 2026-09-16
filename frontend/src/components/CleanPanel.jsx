import { useState } from "react";
import { apiFetch } from "../api/client";
import { isNumericType } from "../utils/types";
import "./CleanPanel.css";

const NULL_STRATEGIES = [
  { value: "drop", label: "Drop rows" },
  { value: "fill_mean", label: "Fill with mean", numericOnly: true },
  { value: "fill_median", label: "Fill with median", numericOnly: true },
  { value: "fill_mode", label: "Fill with mode" },
  { value: "fill_value", label: "Fill with custom value" },
];

function formatValue(v) {
  if (v === null || v === undefined) return "N/A";
  return typeof v === "number" ? v.toLocaleString() : String(v);
}

function DuplicatesBlock({ table, onChanged }) {
  const [preview, setPreview] = useState(null); // null | 'loading' | { affectedRowCount, sampleGroups }
  const [removing, setRemoving] = useState(false);

  async function check() {
    setPreview("loading");
    const res = await apiFetch(`/api/clean/${table.name}/duplicates`);
    setPreview(await res.json());
  }

  async function remove() {
    setRemoving(true);
    await apiFetch(`/api/clean/${table.name}/duplicates/remove`, { method: "POST" });
    setRemoving(false);
    setPreview(null);
    onChanged();
  }

  return (
    <div className="clean-block">
      <div className="clean-block-row">
        <span className="clean-block-label">Exact-duplicate rows</span>
        {preview === null && (
          <button className="clean-btn" onClick={check}>Check</button>
        )}
        {preview === "loading" && <span className="clean-status dim">checking…</span>}
        {preview && preview !== "loading" && (
          <>
            <span className={preview.affectedRowCount > 0 ? "clean-status warn" : "clean-status good"}>
              {preview.affectedRowCount} duplicate row{preview.affectedRowCount === 1 ? "" : "s"}
            </span>
            {preview.affectedRowCount > 0 && (
              <button className="clean-btn danger" onClick={remove} disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NullColumnBlock({ table, column, nullCount, nullPct, onChanged }) {
  const numeric = isNumericType(column.type);
  const options = NULL_STRATEGIES.filter((s) => !s.numericOnly || numeric);
  const [strategy, setStrategy] = useState(options[0].value);
  const [value, setValue] = useState("");
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  async function apply() {
    setApplying(true);
    setResult(null);
    const res = await apiFetch(`/api/clean/${table.name}/nulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: column.name, strategy, value: strategy === "fill_value" ? value : undefined }),
    });
    const data = await res.json();
    setApplying(false);
    if (!res.ok) {
      setResult({ error: data.error });
      return;
    }
    setResult({ affectedCount: data.affectedCount });
    onChanged();
  }

  return (
    <div className="clean-block-row">
      <span className="clean-block-label">
        {column.name} <span className="dim">({nullCount} null{nullCount === 1 ? "" : "s"}, {nullPct}%)</span>
      </span>
      <select className="clean-select" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {strategy === "fill_value" && (
        <input
          className="clean-input"
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <button className="clean-btn primary" onClick={apply} disabled={applying}>
        {applying ? "Applying…" : "Apply"}
      </button>
      {result?.error && <span className="clean-status warn">{result.error}</span>}
      {result && !result.error && <span className="clean-status good">fixed {result.affectedCount}</span>}
    </div>
  );
}

function OutlierColumnBlock({ table, column, onChanged }) {
  const [preview, setPreview] = useState(null); // null | 'loading' | { bounds, flaggedCount }
  const [removing, setRemoving] = useState(false);

  async function check() {
    setPreview("loading");
    const res = await apiFetch(`/api/clean/${table.name}/outliers?column=${encodeURIComponent(column.name)}`);
    setPreview(await res.json());
  }

  async function remove() {
    setRemoving(true);
    await apiFetch(`/api/clean/${table.name}/outliers/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: column.name }),
    });
    setRemoving(false);
    setPreview(null);
    onChanged();
  }

  return (
    <div className="clean-block-row">
      <span className="clean-block-label">{column.name} <span className="dim">(IQR outliers)</span></span>
      {preview === null && <button className="clean-btn" onClick={check}>Check</button>}
      {preview === "loading" && <span className="clean-status dim">checking…</span>}
      {preview && preview !== "loading" && (
        <>
          <span className={preview.flaggedCount > 0 ? "clean-status warn" : "clean-status good"}>
            {preview.flaggedCount} flagged
            {preview.bounds && preview.flaggedCount > 0 && (
              <span className="dim"> (outside {formatValue(+preview.bounds.lower.toFixed(1))}–{formatValue(+preview.bounds.upper.toFixed(1))})</span>
            )}
          </span>
          {preview.flaggedCount > 0 && (
            <button className="clean-btn danger" onClick={remove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TableCleanCard({ table, profileTable, onChanged }) {
  const [resetting, setResetting] = useState(false);

  const nullColumns = (profileTable?.columns || []).filter((c) => c.nullCount > 0);
  const numericColumns = table.columns.filter((c) => isNumericType(c.type));

  async function reset() {
    setResetting(true);
    await apiFetch(`/api/clean/${table.name}/reset`, { method: "POST" });
    setResetting(false);
    onChanged();
  }

  return (
    <div className="clean-table-card">
      <div className="clean-table-header">
        <span className="schema-table-name">{table.name}</span>
        <button className="clean-btn ghost" onClick={reset} disabled={resetting}>
          {resetting ? "Resetting…" : "Reset to original"}
        </button>
      </div>

      <div className="clean-section">
        <div className="clean-section-title">Duplicates</div>
        <DuplicatesBlock table={table} onChanged={onChanged} />
      </div>

      <div className="clean-section">
        <div className="clean-section-title">Missing values</div>
        {nullColumns.length === 0 ? (
          <p className="clean-empty">No nulls detected.</p>
        ) : (
          nullColumns.map((col) => {
            const columnDef = table.columns.find((c) => c.name === col.name);
            return (
              <NullColumnBlock
                key={col.name}
                table={table}
                column={columnDef}
                nullCount={col.nullCount}
                nullPct={col.nullPct}
                onChanged={onChanged}
              />
            );
          })
        )}
      </div>

      <div className="clean-section">
        <div className="clean-section-title">Outliers (numeric columns)</div>
        {numericColumns.length === 0 ? (
          <p className="clean-empty">No numeric columns.</p>
        ) : (
          numericColumns.map((col) => (
            <OutlierColumnBlock key={col.name} table={table} column={col} onChanged={onChanged} />
          ))
        )}
      </div>
    </div>
  );
}

export default function CleanPanel({ tables, profileTables, status, onChanged }) {
  if (status === "empty") {
    return <p className="profile-empty">Upload a file above to unlock cleaning actions.</p>;
  }

  return (
    <div className="clean-list">
      {tables.map((table) => (
        <TableCleanCard
          key={table.name}
          table={table}
          profileTable={(profileTables || []).find((p) => p.name === table.name)}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}
