-- ============================================================
-- Walmart Retail Analytics — SQL Analysis Queries
-- Dataset: ~10,000 transactions across 100 Walmart branches (US), 2019-2023
-- Engine: SQLite (portable, run against the loaded `sales` table)
-- ============================================================

-- Schema (as loaded):
-- sales(invoice_id, Branch, City, category, unit_price, quantity, date, time,
--       payment_method, rating, profit_margin, total, profit)
-- profit = total * profit_margin (derived column)

-- 1. Revenue trend over time (monthly)
SELECT
    strftime('%Y-%m', date) AS month,
    ROUND(SUM(total), 2) AS revenue,
    ROUND(SUM(profit), 2) AS profit,
    COUNT(*) AS orders
FROM sales
GROUP BY month
ORDER BY month;

-- 2. Revenue and order volume by category
SELECT
    category,
    ROUND(SUM(total), 2) AS revenue,
    ROUND(SUM(profit), 2) AS profit,
    COUNT(*) AS orders,
    ROUND(AVG(rating), 2) AS avg_rating
FROM sales
GROUP BY category
ORDER BY revenue DESC;

-- 3. Top 10 performing branches by revenue
SELECT
    Branch,
    City,
    ROUND(SUM(total), 2) AS revenue,
    COUNT(*) AS orders,
    ROUND(AVG(rating), 2) AS avg_rating
FROM sales
GROUP BY Branch, City
ORDER BY revenue DESC
LIMIT 10;

-- 4. Revenue by payment method
SELECT
    payment_method,
    COUNT(*) AS transactions,
    ROUND(SUM(total), 2) AS revenue,
    ROUND(SUM(quantity), 0) AS items_sold
FROM sales
GROUP BY payment_method
ORDER BY revenue DESC;

-- 5. Year-over-year growth rate
SELECT
    strftime('%Y', date) AS year,
    ROUND(SUM(total), 2) AS revenue
FROM sales
GROUP BY year
ORDER BY year;
-- Growth % computed in the export script as:
-- (current_year_revenue - previous_year_revenue) / previous_year_revenue * 100

-- 6. Sales by day of week (identify busiest days)
SELECT
    CASE strftime('%w', date)
        WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
    END AS weekday,
    COUNT(*) AS transactions,
    ROUND(SUM(total), 2) AS revenue
FROM sales
GROUP BY weekday
ORDER BY revenue DESC;

-- 7. Average order value and rating by category, ranked
SELECT
    category,
    ROUND(AVG(total), 2) AS avg_order_value,
    ROUND(AVG(rating), 2) AS avg_rating,
    ROUND(AVG(profit_margin) * 100, 2) AS avg_margin_pct
FROM sales
GROUP BY category
ORDER BY avg_order_value DESC;

-- 8. Overall KPI summary
SELECT
    ROUND(SUM(total), 2) AS total_revenue,
    ROUND(SUM(profit), 2) AS total_profit,
    COUNT(*) AS total_orders,
    ROUND(AVG(total), 2) AS avg_order_value,
    ROUND(AVG(rating), 2) AS avg_rating,
    COUNT(DISTINCT Branch) AS branch_count,
    COUNT(DISTINCT City) AS city_count
FROM sales;
