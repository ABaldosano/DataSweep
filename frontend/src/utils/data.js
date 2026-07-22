const BASE = import.meta.env.BASE_URL + "data/";

async function loadJSON(file) {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  return res.json();
}

export async function loadAllData() {
  const [
    kpi,
    revenueTrend,
    categoryBreakdown,
    categoryDetail,
    topBranches,
    paymentMethods,
    yearlyGrowth,
    weekdaySales,
    transactions,
  ] = await Promise.all([
    loadJSON("kpi_summary.json"),
    loadJSON("revenue_trend.json"),
    loadJSON("category_breakdown.json"),
    loadJSON("category_detail.json"),
    loadJSON("top_branches.json"),
    loadJSON("payment_methods.json"),
    loadJSON("yearly_growth.json"),
    loadJSON("weekday_sales.json"),
    loadJSON("transactions.json"),
  ]);

  return {
    kpi,
    revenueTrend,
    categoryBreakdown,
    categoryDetail,
    topBranches,
    paymentMethods,
    yearlyGrowth,
    weekdaySales,
    transactions,
  };
}

// Filters the raw transaction list by date range + category, then re-derives
// every aggregate the dashboard needs. All client-side, no network calls.
export function deriveFromTransactions(transactions, { startDate, endDate, category }) {
  const filtered = transactions.filter((t) => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    if (category && category !== "All" && t.category !== category) return false;
    return true;
  });

  const totalRevenue = filtered.reduce((s, t) => s + t.total, 0);
  const totalProfit = filtered.reduce((s, t) => s + t.profit, 0);
  const totalOrders = filtered.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const avgRating = totalOrders
    ? filtered.reduce((s, t) => s + t.rating, 0) / totalOrders
    : 0;

  const byMonth = {};
  const byCategory = {};
  const byBranch = {};
  const byPayment = {};

  for (const t of filtered) {
    const month = t.date.slice(0, 7);
    byMonth[month] = byMonth[month] || { month, revenue: 0, orders: 0 };
    byMonth[month].revenue += t.total;
    byMonth[month].orders += 1;

    byCategory[t.category] = byCategory[t.category] || {
      category: t.category,
      revenue: 0,
      orders: 0,
      ratingSum: 0,
    };
    byCategory[t.category].revenue += t.total;
    byCategory[t.category].orders += 1;
    byCategory[t.category].ratingSum += t.rating;

    const key = `${t.branch}|${t.city}`;
    byBranch[key] = byBranch[key] || {
      branch: t.branch,
      city: t.city,
      revenue: 0,
      orders: 0,
    };
    byBranch[key].revenue += t.total;
    byBranch[key].orders += 1;

    byPayment[t.payment_method] = byPayment[t.payment_method] || {
      payment_method: t.payment_method,
      revenue: 0,
      transactions: 0,
    };
    byPayment[t.payment_method].revenue += t.total;
    byPayment[t.payment_method].transactions += 1;
  }

  const revenueTrend = Object.values(byMonth).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const categoryBreakdown = Object.values(byCategory)
    .map((c) => ({
      category: c.category,
      revenue: Math.round(c.revenue * 100) / 100,
      orders: c.orders,
      avg_rating: Math.round((c.ratingSum / c.orders) * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topBranches = Object.values(byBranch)
    .map((b) => ({ ...b, revenue: Math.round(b.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const paymentMethods = Object.values(byPayment)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    kpi: {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_profit: Math.round(totalProfit * 100) / 100,
      total_orders: totalOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      avg_rating: Math.round(avgRating * 100) / 100,
    },
    revenueTrend,
    categoryBreakdown,
    topBranches,
    paymentMethods,
  };
}

export function formatCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n) {
  return new Intl.NumberFormat("en-US").format(n);
}
