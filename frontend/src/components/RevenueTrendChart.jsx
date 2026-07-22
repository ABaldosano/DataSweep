import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from "chart.js";
import "./Charts.css";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

const PALETTE = {
  light: { line: "#a8823f", fill: "rgba(168, 130, 63, 0.14)", tooltipBg: "#ffffff", tooltipBorder: "rgba(0,0,0,0.1)", text: "#0a0a0a", muted: "#5c5c5c", grid: "rgba(0,0,0,0.06)" },
  dark: { line: "#c9a96e", fill: "rgba(201, 169, 110, 0.14)", tooltipBg: "#141414", tooltipBorder: "rgba(255,255,255,0.09)", text: "#fafafa", muted: "#9a9a9a", grid: "rgba(255,255,255,0.06)" },
};

export default function RevenueTrendChart({ data, theme = "light" }) {
  const p = PALETTE[theme] || PALETTE.light;

  const chartData = {
    labels: data.map((d) => d.month),
    datasets: [
      {
        label: "Revenue",
        data: data.map((d) => d.revenue),
        borderColor: p.line,
        backgroundColor: p.fill,
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: p.line,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: p.tooltipBg,
        borderColor: p.tooltipBorder,
        borderWidth: 1,
        titleColor: p.text,
        bodyColor: p.text,
        titleFont: { family: "JetBrains Mono" },
        bodyFont: { family: "JetBrains Mono" },
        callbacks: {
          label: (ctx) => `$${ctx.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: p.muted, font: { family: "JetBrains Mono", size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        grid: { color: p.grid },
      },
      y: {
        ticks: {
          color: p.muted,
          font: { family: "JetBrains Mono", size: 10 },
          callback: (v) => `$${(v / 1000).toFixed(0)}k`,
        },
        grid: { color: p.grid },
      },
    },
  };

  return (
    <div className="chart-frame">
      <Line data={chartData} options={options} />
    </div>
  );
}
