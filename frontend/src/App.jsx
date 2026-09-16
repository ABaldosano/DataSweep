import { useEffect, useState } from "react";
import ControlPanel from "./components/ControlPanel";
import Sidebar from "./components/Sidebar";
import Section from "./components/Section";
import OverviewPanel from "./components/OverviewPanel";
import UploadPanel from "./components/UploadPanel";
import ProfilePanel from "./components/ProfilePanel";
import CleanPanel from "./components/CleanPanel";
import ExportPanel from "./components/ExportPanel";
import { apiFetch } from "./api/client";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

const SECTION_META = {
  overview: { index: "00", title: "Overview", subtitle: "Row counts, completeness, and where your nulls live, at a glance" },
  upload: { index: "01", title: "Upload", subtitle: "Accepts .sql (CREATE TABLE / INSERT only) or .csv" },
  profile: { index: "02", title: "Profile", subtitle: "Every column, broken down by nulls, uniqueness, range, and sample values" },
  clean: { index: "03", title: "Clean", subtitle: "Preview first, apply second -- any table can be reset back to its original upload" },
  export: { index: "04", title: "Export", subtitle: "Download the cleaned data, with a clear before-and-after summary" },
};

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [backendStatus, setBackendStatus] = useState("checking");
  const [tables, setTables] = useState([]);
  const [profileTables, setProfileTables] = useState([]);
  const [profileStatus, setProfileStatus] = useState("empty"); // empty | loading | ok | error
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const meta = SECTION_META[activeSection];

  return (
    <>
      <ControlPanel />
      <div className="app-layout">
        <Sidebar
          active={activeSection}
          onSelect={setActiveSection}
          theme={theme}
          onToggleTheme={toggleTheme}
          backendStatus={backendStatus}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />

        <div className="app-shell">
          <header className="app-header">
            <span className="eyebrow">Datasweep · Data Profiler &amp; Cleaner</span>
            <h1>Upload it messy. Export it clean.</h1>
            <p className="header-sub">
              Drop in a .sql dump or .csv file to get a full schema profile,
              null and duplicate detection, and a cleaned export -- no
              assumptions about your dataset baked in. Every upload stays
              private to your session and never touches anyone else's data.
            </p>
          </header>

          <Section index={meta.index} title={meta.title} subtitle={meta.subtitle}>
            {activeSection === "overview" && (
              <OverviewPanel tables={tables} profileTables={profileTables} status={profileStatus} />
            )}
            {activeSection === "upload" && (
              <UploadPanel tables={tables} onUploaded={() => reloadProfile()} />
            )}
            {activeSection === "profile" && (
              <ProfilePanel tables={profileTables} status={profileStatus} />
            )}
            {activeSection === "clean" && (
              <CleanPanel
                tables={tables}
                profileTables={profileTables}
                status={profileStatus}
                onChanged={() => reloadProfile()}
              />
            )}
            {activeSection === "export" && <ExportPanel tables={tables} status={profileStatus} />}
          </Section>

          <footer className="app-footer">Datasweep</footer>
        </div>
      </div>
    </>
  );
}
