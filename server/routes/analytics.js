const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Simple date validator — only allow YYYY-MM-DD format
function isValidDate(d) {
    return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// GET /api/analytics/expenses
router.get('/expenses', async (req, res, next) => {
    try {
        const { start_date, end_date } = req.query;

        if (start_date && !isValidDate(start_date)) return res.status(400).json({ error: 'Invalid start_date format (use YYYY-MM-DD)' });
        if (end_date && !isValidDate(end_date)) return res.status(400).json({ error: 'Invalid end_date format (use YYYY-MM-DD)' });

        let query = `SELECT id, date, category, amount, description, 'expense' as type FROM expenses WHERE 1=1`;
        let args = [];
        if (start_date) { query += ' AND date >= ?'; args.push(start_date); }
        if (end_date) { query += ' AND date <= ?'; args.push(end_date); }

        let stitchingQuery = `
            SELECT order_id as id, substr(created_at, 1, 10) as date, assigned_worker as category, stitching_expense as amount, 'Order #' || order_id as description, 'stitching' as type
            FROM orders WHERE stitching_expense > 0
        `;
        let sArgs = [];
        if (start_date) { stitchingQuery += ' AND substr(created_at, 1, 10) >= ?'; sArgs.push(start_date); }
        if (end_date) { stitchingQuery += ' AND substr(created_at, 1, 10) <= ?'; sArgs.push(end_date); }

        const finalQuery = `SELECT * FROM (${query} UNION ALL ${stitchingQuery}) ORDER BY date DESC`;
        const rs = await db.execute({ sql: finalQuery, args: [...args, ...sArgs] });
        res.json(rs.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/analytics/expenses
router.post('/expenses', async (req, res, next) => {
    try {
        const { date, category, amount, description } = req.body;
        if (!date || !category || amount === undefined) {
            return res.status(400).json({ error: 'date, category, amount required' });
        }
        if (!isValidDate(date)) return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });

        await db.execute({
            sql: 'INSERT INTO expenses (date, category, amount, description) VALUES (?,?,?,?)',
            args: [date, String(category).slice(0, 100), parseFloat(amount), String(description || '').slice(0, 500)]
        });
        res.status(201).json({ success: true });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/analytics/expenses/:id
router.delete('/expenses/:id', async (req, res, next) => {
    try {
        await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// GET /api/analytics/summary
router.get('/summary', async (req, res, next) => {
    try {
        res.json(await getSummaryData());
    } catch (err) {
        next(err);
    }
});

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res, next) => {
    try {
        const [summary, expenses, services, customers, monthlyRecords] = await Promise.all([
            getSummaryData(),
            getExpensesData(),
            getTopServicesData(),
            getTopCustomersData(),
            getMonthlyRecordsData()
        ]);
        res.json({ summary, expenses, services, customers, monthlyRecords });
    } catch (err) {
        next(err);
    }
});

async function getMonthlyRecordsData() {
    const rs = await db.execute(`
        SELECT month, SUM(income) as total_income, SUM(expense) as total_expense 
        FROM (
            SELECT substr(booking_date, 1, 7) as month, total_amount as income, 0 as expense FROM orders
            UNION ALL
            SELECT substr(date, 1, 7) as month, 0 as income, amount as expense FROM expenses
            UNION ALL
            SELECT substr(booking_date, 1, 7) as month, 0 as income, stitching_expense as expense FROM orders WHERE stitching_expense > 0
        ) 
        GROUP BY month ORDER BY month DESC LIMIT 12
    `);
    return rs.rows.map(r => ({
        month: r.month,
        total: r.total_income || 0,
        expense: r.total_expense || 0,
        profit: (r.total_income || 0) - (r.total_expense || 0)
    }));
}

async function getSummaryData() {
    const queries = {
        total_income:      "SELECT sum(total_amount) as val FROM orders",
        today_income:      "SELECT sum(total_amount) as val FROM orders WHERE booking_date = date('now', 'localtime')",
        monthly_income:    "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_income:     "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",
        total_stitching:   "SELECT sum(stitching_expense) as val FROM orders",
        today_stitching:   "SELECT sum(stitching_expense) as val FROM orders WHERE booking_date = date('now', 'localtime')",
        monthly_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_stitching:  "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",
        total_expense:     "SELECT sum(amount) as val FROM expenses",
        today_expense:     "SELECT sum(amount) as val FROM expenses WHERE date = date('now', 'localtime')",
        monthly_expense:   "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_expense:    "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",
        total_balance:     "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered'",
        today_balance:     "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND booking_date = date('now', 'localtime')",
        monthly_balance:   "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_balance:    "SELECT sum(total_amount - advance_paid) as val FROM orders WHERE status != 'Delivered' AND substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",
    };

    const queryEntries = Object.entries(queries);
    const rsBatch = await db.batch(queryEntries.map(([, sql]) => sql), "read");
    const results = {};
    queryEntries.forEach(([key], i) => { results[key] = rsBatch[i].rows[0]?.val || 0; });

    results.today_expense   = (results.today_expense   || 0) + (results.today_stitching   || 0);
    results.monthly_expense = (results.monthly_expense || 0) + (results.monthly_stitching || 0);
    results.yearly_expense  = (results.yearly_expense  || 0) + (results.yearly_stitching  || 0);
    results.total_expense   = (results.total_expense   || 0) + (results.total_stitching   || 0);

    results.today_profit   = results.today_income   - results.today_expense;
    results.monthly_profit = results.monthly_income - results.monthly_expense;
    results.yearly_profit  = results.yearly_income  - results.yearly_expense;
    results.net_profit     = results.total_income   - results.total_expense;

    return results;
}

async function getExpensesData(start_date, end_date) {
    let q = `SELECT id, date, category, amount, description, 'expense' as type FROM expenses WHERE 1=1`;
    const args = [];
    if (start_date) { q += ' AND date >= ?'; args.push(start_date); }
    if (end_date)   { q += ' AND date <= ?'; args.push(end_date); }

    let sq = `SELECT order_id as id, booking_date as date, assigned_worker as category, stitching_expense as amount, 'Order #' || order_id as description, 'stitching' as type FROM orders WHERE stitching_expense > 0`;
    const sargs = [];
    if (start_date) { sq += ' AND booking_date >= ?'; sargs.push(start_date); }
    if (end_date)   { sq += ' AND booking_date <= ?'; sargs.push(end_date); }

    const rs = await db.execute({ sql: `SELECT * FROM (${q} UNION ALL ${sq}) ORDER BY date DESC LIMIT 50`, args: [...args, ...sargs] });
    return rs.rows;
}

async function getTopServicesData() {
    const rs = await db.execute(`SELECT service_type, COUNT(*) as count, SUM(price * quantity) as revenue FROM services GROUP BY service_type ORDER BY revenue DESC LIMIT 5`);
    return rs.rows;
}

async function getTopCustomersData() {
    const rs = await db.execute(`SELECT c.id, c.name, c.phone_number, COUNT(o.order_id) as order_count, SUM(o.total_amount) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id ORDER BY total_spent DESC LIMIT 5`);
    return rs.rows;
}

router.get('/top-services', async (req, res, next) => {
    try { res.json(await getTopServicesData()); } catch (err) { next(err); }
});

router.get('/top-customers', async (req, res, next) => {
    try { res.json(await getTopCustomersData()); } catch (err) { next(err); }
});

// GET /api/analytics/customers-export
// Returns all customer orders with measurements for Excel export
router.get('/customers-export', async (req, res, next) => {
    try {
        const rs = await db.execute(`
            SELECT
                c.name                  AS customer_name,
                c.phone_number          AS phone,
                o.order_id              AS order_id,
                o.booking_date          AS order_date,
                o.delivery_date         AS delivery_date,
                o.status                AS status,
                o.measurement_type      AS measurement_type,
                o.total_amount          AS total_amount,
                o.advance_paid          AS advance_paid,
                o.balance_amount        AS balance,
                o.payment_method        AS payment_method,
                o.assigned_worker       AS assigned_worker,
                o.notes                 AS notes,
                m.length                AS m_length,
                m.shoulder              AS shoulder,
                m.chest                 AS chest,
                m.waist                 AS waist,
                m.dot                   AS dot,
                m.back_neck             AS back_neck,
                m.front_neck            AS front_neck,
                m.sleeves_length        AS sleeves_length,
                m.sleeves_round         AS sleeves_round,
                m.armhole               AS armhole,
                m.chest_distance        AS chest_distance,
                m.t_length              AS top_length,
                m.t_shoulder            AS top_shoulder,
                m.t_chest               AS top_chest,
                m.t_waist               AS top_waist,
                m.t_back_neck           AS top_back_neck,
                m.t_front_neck          AS top_front_neck,
                m.t_sleeves_length      AS top_sleeves_length,
                m.t_sleeves_round       AS top_sleeves_round,
                m.t_half_body           AS top_half_body,
                m.t_hip                 AS top_hip,
                m.b_length              AS bottom_length,
                m.b_bottom_round        AS bottom_round,
                m.b_hip                 AS bottom_hip,
                m.b_fly                 AS bottom_fly,
                m.b_thai                AS bottom_thigh,
                m.b_knee                AS bottom_knee,
                m.extra_measurements    AS extra_measurements
            FROM orders o
            JOIN customers c ON c.id = o.customer_id
            LEFT JOIN measurements m ON m.customer_id = c.id
            ORDER BY o.booking_date DESC, o.order_id DESC
        `);
        res.json(rs.rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
