import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
import "./Charts.css";

ChartJS.register(BarElement, LinearScale, CategoryScale, Tooltip);

const PALETTES = {
  light: ["#a13d2d", "#a8823f", "#4f6b52", "#3d5372", "#7a5a3d", "#6a3d6a"],
  dark: ["#c2564a", "#c9a96e", "#86a889", "#6f8cb0", "#b08a6f", "#a06fa0"],
};

const THEME_TOKENS = {
  light: { tooltipBg: "#ffffff", tooltipBorder: "rgba(0,0,0,0.1)", text: "#0a0a0a", muted: "#5c5c5c", grid: "rgba(0,0,0,0.06)" },
  dark: { tooltipBg: "#141414", tooltipBorder: "rgba(255,255,255,0.09)", text: "#fafafa", muted: "#9a9a9a", grid: "rgba(255,255,255,0.06)" },
};

export default function CategoryChart({ data, theme = "light" }) {
  const palette = PALETTES[theme] || PALETTES.light;
  const t = THEME_TOKENS[theme] || THEME_TOKENS.light;

  const chartData = {
    labels: data.map((d) => d.category),
    datasets: [
      {
        label: "Revenue",
        data: data.map((d) => d.revenue),
        backgroundColor: data.map((_, i) => palette[i % palette.length]),
        borderRadius: 2,
        barThickness: 28,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        borderWidth: 1,
        titleColor: t.text,
        bodyColor: t.text,
        titleFont: { family: "JetBrains Mono" },
        bodyFont: { family: "JetBrains Mono" },
        callbacks: {
          label: (ctx) => `$${ctx.parsed.x.toLocaleString()}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: t.muted,
          font: { family: "JetBrains Mono", size: 10 },
          callback: (v) => `$${(v / 1000).toFixed(0)}k`,
        },
        grid: { color: t.grid },
      },
      y: {
        ticks: { color: t.text, font: { family: "Inter", size: 12 } },
        grid: { display: false },
      },
    },
  };

  return (
    <div className="chart-frame chart-frame--compact">
      <Bar data={chartData} options={options} />
    </div>
  );
}
