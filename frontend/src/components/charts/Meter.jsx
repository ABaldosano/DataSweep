import "./charts.css";

// Simple radial meter, 0-100 value, arc from -120deg to 120deg.
export default function Meter({ value, label, size = 120, tone = "good" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcFraction = 0.75; // 270 degree sweep
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (clamped / 100);

  return (
    <div className="meter">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-light)"
            strokeWidth={10}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`var(--meter-${tone})`}
            strokeWidth={10}
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
          />
        </g>
        <text x="50%" y="52%" textAnchor="middle" className="meter-value">
          {Math.round(clamped)}%
        </text>
      </svg>
      <span className="meter-label">{label}</span>
    </div>
  );
}
