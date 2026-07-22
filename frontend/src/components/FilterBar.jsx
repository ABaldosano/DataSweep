import "./FilterBar.css";

const CATEGORIES = [
  "All",
  "Fashion accessories",
  "Home and lifestyle",
  "Electronic accessories",
  "Food and beverages",
  "Sports and travel",
  "Health and beauty",
];

export default function FilterBar({ filters, onChange, onReset }) {
  return (
    <div className="filter-bar">
      <div className="filter-field">
        <label htmlFor="start-date">From</label>
        <input
          id="start-date"
          type="date"
          value={filters.startDate}
          min="2019-01-01"
          max="2023-12-31"
          onChange={(e) => onChange({ ...filters, startDate: e.target.value })}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="end-date">To</label>
        <input
          id="end-date"
          type="date"
          value={filters.endDate}
          min="2019-01-01"
          max="2023-12-31"
          onChange={(e) => onChange({ ...filters, endDate: e.target.value })}
        />
      </div>
      <div className="filter-field">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <button className="filter-reset" onClick={onReset} type="button">
        Reset filters
      </button>
    </div>
  );
}
