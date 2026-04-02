const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/analytics/expenses
router.get('/expenses', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
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
        const finalArgs = [...args, ...sArgs];

        const rs = await db.execute({ sql: finalQuery, args: finalArgs });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/analytics/expenses
router.post('/expenses', async (req, res) => {
    try {
        const { date, category, amount, description } = req.body;
        if (!date || !category || amount === undefined) {
            return res.status(400).json({ error: 'date, category, amount required' });
        }
        await db.execute({
            sql: 'INSERT INTO expenses (date, category, amount, description) VALUES (?,?,?,?)',
            args: [date, category, parseFloat(amount), description || '']
        });
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/analytics/expenses/:id
router.delete('/expenses/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/summary
// Returns overview of Income vs Expense for Today, This Month, This Year, and All Time
router.get('/summary', async (req, res) => {
    try {
        const results = await getSummaryData();
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/analytics/dashboard
// Combines summary, expenses, services, and customers for faster loading
router.get('/dashboard', async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

async function getMonthlyRecordsData() {
    const query = `
        SELECT month, SUM(income) as total_income, SUM(expense) as total_expense 
        FROM (
            SELECT substr(booking_date, 1, 7) as month, total_amount as income, 0 as expense FROM orders
            UNION ALL
            SELECT substr(date, 1, 7) as month, 0 as income, amount as expense FROM expenses
            UNION ALL
            SELECT substr(booking_date, 1, 7) as month, 0 as income, stitching_expense as expense FROM orders WHERE stitching_expense > 0
        ) 
        GROUP BY month 
        ORDER BY month DESC
        LIMIT 12
    `;
    const rs = await db.execute(query);
    return rs.rows.map(r => ({
        month: r.month,
        total: r.total_income || 0,
        expense: r.total_expense || 0,
        profit: (r.total_income || 0) - (r.total_expense || 0)
    }));
}

async function getSummaryData() {
    const queries = {
        total_income: "SELECT sum(total_amount) as val FROM orders",
        today_income: "SELECT sum(total_amount) as val FROM orders WHERE booking_date = date('now', 'localtime')",
        monthly_income: "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_income: "SELECT sum(total_amount) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",

        total_stitching: "SELECT sum(stitching_expense) as val FROM orders",
        today_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE booking_date = date('now', 'localtime')",
        monthly_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_stitching: "SELECT sum(stitching_expense) as val FROM orders WHERE substr(booking_date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",

        total_expense: "SELECT sum(amount) as val FROM expenses",
        today_expense: "SELECT sum(amount) as val FROM expenses WHERE date = date('now', 'localtime')",
        monthly_expense: "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 7) = substr(date('now', 'localtime'), 1, 7)",
        yearly_expense: "SELECT sum(amount) as val FROM expenses WHERE substr(date, 1, 4) = substr(date('now', 'localtime'), 1, 4)",
    };

    const queryEntries = Object.entries(queries);
    const rsBatch = await db.batch(queryEntries.map(([_, sql]) => sql), "read");
    
    const results = {};
    queryEntries.forEach(([key, _], i) => results[key] = rsBatch[i].rows[0]?.val || 0);

    results.today_expense = (results.today_expense || 0) + (results.today_stitching || 0);
    results.monthly_expense = (results.monthly_expense || 0) + (results.monthly_stitching || 0);
    results.yearly_expense = (results.yearly_expense || 0) + (results.yearly_stitching || 0);
    results.total_expense = (results.total_expense || 0) + (results.total_stitching || 0);

    results.today_profit = results.today_income - results.today_expense;
    results.monthly_profit = results.monthly_income - results.monthly_expense;
    results.yearly_profit = results.yearly_income - results.yearly_expense;
    results.net_profit = results.total_income - results.total_expense;

    return results;
}

async function getExpensesData(start_date, end_date) {
    let q = `SELECT id, date, category, amount, description, 'expense' as type FROM expenses WHERE 1=1`;
    let args = [];
    if (start_date) { q += ' AND date >= ?'; args.push(start_date); }
    if (end_date) { q += ' AND date <= ?'; args.push(end_date); }

    let sq = `SELECT order_id as id, booking_date as date, assigned_worker as category, stitching_expense as amount, 'Order #' || order_id as description, 'stitching' as type FROM orders WHERE stitching_expense > 0`;
    let sargs = [];
    if (start_date) { sq += ' AND booking_date >= ?'; sargs.push(start_date); }
    if (end_date) { sq += ' AND booking_date <= ?'; sargs.push(end_date); }

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

router.get('/top-services', async (req, res) => {
    try { res.json(await getTopServicesData()); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/top-customers', async (req, res) => {
    try { res.json(await getTopCustomersData()); } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
