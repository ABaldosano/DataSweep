import "./TableFilterPanel.css";

// Left-hand filter rail: lets the user narrow every Overview chart down to a
// subset of uploaded tables. Purely client-side selection state, no new
// endpoints or changed data logic.
export default function TableFilterPanel({ tables, selected, onToggle, onSelectAll, onSelectNone }) {
  const allSelected = tables.length > 0 && selected.size === tables.length;

  return (
    <div className="table-filter-panel">
      <div className="table-filter-title">Tables</div>
      <label className="table-filter-row table-filter-all">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => (allSelected ? onSelectNone() : onSelectAll())}
        />
        All
      </label>
      {tables.map((t) => (
        <label className="table-filter-row" key={t.name}>
          <input
            type="checkbox"
            checked={selected.has(t.name)}
            onChange={() => onToggle(t.name)}
          />
          {t.name}
        </label>
      ))}
      {tables.length === 0 && <p className="table-filter-empty">No tables yet.</p>}
    </div>
  );
}
