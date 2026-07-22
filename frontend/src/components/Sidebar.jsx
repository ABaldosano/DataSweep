import ThemeToggle from "./ThemeToggle";
import "./Sidebar.css";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "upload", label: "Upload", icon: "upload" },
  { id: "profile", label: "Profile", icon: "table" },
  { id: "clean", label: "Clean", icon: "sparkle" },
  { id: "export", label: "Export", icon: "download" },
];

const ICONS = {
  grid: (
    <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
  ),
  upload: <path d="M12 3v12m0-12 5 5m-5-5-5 5M5 20h14" />,
  table: <path d="M3 5h18M3 12h18M3 19h18M8 5v14M16 5v14" />,
  sparkle: (
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
  ),
  download: <path d="M12 3v12m0 0-4-4m4 4 4-4M5 20h14" />,
};

function Icon({ name }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

export default function Sidebar({ active, onSelect, theme, onToggleTheme, backendStatus, collapsed, onToggleCollapsed }) {
  const statusLabel =
    backendStatus === "ok" ? "connected" : backendStatus === "error" ? "unreachable" : "checking…";

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <img className="sidebar-brand-mark" src="/favicon.svg" alt="Datasweep" width={32} height={32} />
          {!collapsed && (
            <div>
              <span className="sidebar-brand-name">Datasweep</span>
              <span className="sidebar-brand-sub">SQL Profiler &amp; Cleaner</span>
            </div>
          )}
        </div>
        <button className="sidebar-collapse-btn" onClick={onToggleCollapsed} aria-label="Toggle sidebar width">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item${active === item.id ? " active" : ""}`}
            onClick={() => onSelect(item.id)}
            title={item.label}
          >
            <Icon name={item.icon} />
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span className={`sidebar-status status-${backendStatus === "checking" ? "pending" : backendStatus}`}>
          <span className="status-dot" />
          {!collapsed && statusLabel}
        </span>
        <div className="sidebar-theme">
          {!collapsed && <span className="sidebar-theme-label">Theme</span>}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </aside>
  );
}
