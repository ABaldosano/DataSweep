import { useEffect, useState } from "react";
import ControlPanel from "./components/ControlPanel";
import ThemeToggle from "./components/ThemeToggle";
import Section from "./components/Section";
import UploadPanel from "./components/UploadPanel";
import ProfilePanel from "./components/ProfilePanel";
import CleanPanel from "./components/CleanPanel";
import ExportPanel from "./components/ExportPanel";
import { apiFetch } from "./api/client";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [backendStatus, setBackendStatus] = useState("checking");
  const [tables, setTables] = useState([]);
  const [profileTables, setProfileTables] = useState([]);
  const [profileStatus, setProfileStatus] = useState("empty"); // empty | loading | ok | error

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/health")
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

  async function reloadProfile() {
    setProfileStatus("loading");
    try {
      const res = await apiFetch("/api/profile");
      const data = await res.json();
      setProfileTables(data.tables || []);
      setTables(data.tables.map((t) => ({ name: t.name, rowCount: t.rowCount, columns: t.columns })));
      setProfileStatus("ok");
    } catch {
      setProfileStatus("error");
    }
  }

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
            duplicate detection, and a cleaned export - no dataset assumptions
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
          <UploadPanel
            tables={tables}
            onUploaded={() => reloadProfile()}
          />
        </Section>

        <Section index="02" title="Profile" subtitle="Per-column nulls, uniqueness, range, and samples">
          <ProfilePanel tables={profileTables} status={profileStatus} />
        </Section>

        <Section index="03" title="Clean" subtitle="Preview first, then apply -- every table can be reset to its original upload">
          <CleanPanel
            tables={tables}
            profileTables={profileTables}
            status={profileStatus}
            onChanged={() => reloadProfile()}
          />
        </Section>

        <Section index="04" title="Export" subtitle="Download the cleaned data, with a before/after summary">
          <ExportPanel tables={tables} status={profileStatus} />
        </Section>

        <footer className="app-footer">
          Datasweep - React + Vite frontend, Express + SQLite backend, per-session sandboxing
        </footer>
      </div>
    </>
  );
}
