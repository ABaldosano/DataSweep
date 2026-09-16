import { useRef, useState } from "react";
import { apiFetch } from "../api/client";
import "./UploadPanel.css";

const ACCEPTED = [".sql", ".csv"];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPanel({ tables, onUploaded }) {
  const [status, setStatus] = useState("idle"); // idle | uploading | error
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [lastFile, setLastFile] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setStatus("error");
      setError(`"${ext}" isn't supported. Upload a .sql or .csv file.`);
      return;
    }

    setStatus("uploading");
    setError(null);
    setSummary(null);
    setLastFile({ name: file.name, size: file.size });

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await apiFetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Upload failed.");
        return;
      }

      setStatus("idle");
      setSummary(data.loadSummary || null);
      onUploaded(data.tables);
    } catch (err) {
      setStatus("error");
      setError("We couldn't connect. Please check your connection and try again.");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  return (
    <div>
      <div
        className={`upload-drop${dragActive ? " drag-active" : ""}${status === "uploading" ? " uploading" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".sql,.csv"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <strong>
          {status === "uploading"
            ? `Loading ${lastFile?.name}…`
            : "Drop a .sql or .csv file here, or click to choose one"}
        </strong>
        {status !== "uploading" && "CREATE TABLE / INSERT statements only for .sql -- nothing else executes"}
      </div>

      {status === "error" && (
        <div className="upload-error">
          <span className="status-dot" />
          {error}
        </div>
      )}

      {summary && (summary.skippedCount > 0 || summary.failedCount > 0) && (
        <div className="upload-info">
          <span className="status-dot" />
          <div>
            Loaded {summary.executedCount.toLocaleString()} of {summary.totalStatements.toLocaleString()} statements.
            {summary.skippedCount > 0 && (
              <> {summary.skippedCount.toLocaleString()} skipped (not <code>CREATE TABLE</code>/<code>INSERT</code> -- e.g. admin commands, views, stored procedures).</>
            )}
            {summary.failedCount > 0 && (
              <> {summary.failedCount.toLocaleString()} failed to execute.</>
            )}
            {(summary.skippedExamples?.length > 0 || summary.failedExamples?.length > 0) && (
              <details>
                <summary>Show examples</summary>
                {summary.skippedExamples?.map((s) => (
                  <div className="upload-info-example" key={`s${s.index}`}>#{s.index} skipped: {s.preview}</div>
                ))}
                {summary.failedExamples?.map((f, i) => (
                  <div className="upload-info-example" key={`f${i}`}>failed: {f.preview} -- {f.error}</div>
                ))}
              </details>
            )}
          </div>
        </div>
      )}

      {tables.length > 0 && (
        <div className="schema-list">
          {tables.map((table) => (
            <div className="schema-table" key={table.name}>
              <div className="schema-table-header">
                <span className="schema-table-name">{table.name}</span>
                <span className="schema-table-rows">{table.rowCount.toLocaleString()} rows</span>
              </div>
              <div className="schema-columns">
                {table.columns.map((col) => (
                  <span className="schema-column" key={col.name}>
                    {col.name}
                    <span className={`type-badge type-${col.type.toLowerCase()}`}>{col.type}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
