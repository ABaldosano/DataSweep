import "./Insights.css";

const INSIGHTS = [
  "Two categories drive 81% of revenue. Fashion Accessories and Home & Lifestyle together account for most of both revenue and order volume.",
  "The best-selling categories score lower on satisfaction. Fashion Accessories and Home & Lifestyle average 5.7 to 5.8 out of 10, while a smaller category like Food & Beverages hits 7.1. Worth digging into.",
  "Credit card wins on both counts: 43% of all orders and the most revenue of the three payment methods, just ahead of Ewallet.",
  "Revenue has plateaued since 2020. Full-year revenue has stayed within about a 7% band for three straight years, with no real growth trend.",
  "Branch performance is uneven. The top 10 of 100 branches pull in a disproportionate share of revenue, which points to something beyond category mix, maybe location or staffing.",
  "Margins look healthy: average profit sits near 39% of order total across all transactions and categories.",
];

export default function Insights() {
  return (
    <div className="insights-grid">
      {INSIGHTS.map((text, i) => (
        <div className="insight-card" key={i}>
          <span className="insight-mark">§{i + 1}</span>
          <p>{text}</p>
        </div>
      ))}
    </div>
  );
}
