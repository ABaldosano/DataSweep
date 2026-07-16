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
      onUploaded(data.tables);
    } catch (err) {
      setStatus("error");
      setError("Couldn't reach the backend. Is it running?");
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
