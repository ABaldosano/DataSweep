import "./ThemeToggle.css";

export default function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label="Toggle light and dark theme"
      aria-pressed={theme === "dark"}
    >
      <span className="toggle-thumb" />
    </button>
  );
}
