import "./Section.css";

export default function Section({ index, title, subtitle, children }) {
  return (
    <section className="dash-section">
      <div className="dash-section-header">
        <span className="dash-section-index">{index}</span>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="dash-section-body">{children}</div>
    </section>
  );
}
