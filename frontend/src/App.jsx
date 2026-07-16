import { useEffect, useState } from "react";
import ControlPanel from "./components/ControlPanel";
import ThemeToggle from "./components/ThemeToggle";
import Section from "./components/Section";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [backendStatus, setBackendStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then(() => {
        if (!cancelled) setBackendStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setBackendStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    backendStatus === "ok"
      ? "backend connected"
      : backendStatus === "error"
      ? "backend unreachable"
      : "checking backend…";

  return (
    <>
      <ControlPanel />
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-top">
            <div>
              <span className="eyebrow">Datasweep · SQL Data Profiler &amp; Cleaner</span>
              <h1>Upload it messy. Export it clean.</h1>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <p className="header-sub">
            Drop in a .sql dump or .csv file and get a schema profile, null and
            duplicate detection, and a cleaned export — no dataset assumptions
            baked in. Every upload runs in its own sandboxed, disposable
            database session.
          </p>
          <div style={{ marginTop: 20 }}>
            <span className="status-pill" data-state={backendStatus === "checking" ? "pending" : backendStatus}>
              <span className="status-dot" />
              {statusLabel}
            </span>
          </div>
        </header>

        <Section index="01" title="Upload" subtitle="Accepts .sql (CREATE TABLE / INSERT only) or .csv">
          <div className="upload-drop">
            <strong>Upload coming in the next build step</strong>
            This is the architecture scaffold — file parsing, schema
            profiling, and cleaning actions land next.
          </div>
        </Section>

        <footer className="app-footer">
          Datasweep — architecture scaffold · React + Vite frontend, Express +
          SQLite backend, per-session sandboxing
        </footer>
      </div>
    </>
  );
}
