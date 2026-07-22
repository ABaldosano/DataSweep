import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { formatCurrency } from "../utils/data";
import "./Charts.css";

ChartJS.register(ArcElement, Tooltip);

const PALETTES = {
  light: ["#a13d2d", "#a8823f", "#4f6b52"],
  dark: ["#c2564a", "#c9a96e", "#86a889"],
};

const THEME_TOKENS = {
  light: { border: "#ffffff", tooltipBg: "#ffffff", tooltipBorder: "rgba(0,0,0,0.1)", text: "#0a0a0a" },
  dark: { border: "#0a0a0a", tooltipBg: "#141414", tooltipBorder: "rgba(255,255,255,0.09)", text: "#fafafa" },
};

export default function PaymentChart({ data, theme = "light" }) {
  const palette = PALETTES[theme] || PALETTES.light;
  const t = THEME_TOKENS[theme] || THEME_TOKENS.light;

  const chartData = {
    labels: data.map((d) => d.payment_method),
    datasets: [
      {
        data: data.map((d) => d.revenue),
        backgroundColor: palette,
        borderColor: t.border,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: t.text, font: { family: "Inter", size: 12 }, boxWidth: 12 },
      },
      tooltip: {
        backgroundColor: t.tooltipBg,
        borderColor: t.tooltipBorder,
        borderWidth: 1,
        titleColor: t.text,
        bodyColor: t.text,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
        },
      },
    },
  };

  return (
    <div className="chart-frame chart-frame--compact">
      <Doughnut data={chartData} options={options} />
    </div>
  );
}
