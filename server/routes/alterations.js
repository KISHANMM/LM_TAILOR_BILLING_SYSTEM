const express = require('express');
const router = express.Router();
const { db } = require('../db');

// ─── Helper: build date filter SQL ───────────────────────────────────────────
function buildDateFilter(period, col = 'date') {
    switch (period) {
        case 'today':
            return `AND ${col} = date('now', 'localtime')`;
        case 'week':
            return `AND ${col} >= date('now', 'localtime', 'weekday 0', '-6 days') AND ${col} <= date('now', 'localtime')`;
        case 'month':
            return `AND substr(${col}, 1, 7) = substr(date('now', 'localtime'), 1, 7)`;
        case 'year':
            return `AND substr(${col}, 1, 4) = substr(date('now', 'localtime'), 1, 4)`;
        default:
            return '';
    }
}

// ─── GET /api/alterations/dashboard ──────────────────────────────────────────
// Returns today's date + stats (count of entries, sum of alterations done, sum of amount) for today/week/month/year/alltime
router.get('/dashboard', async (req, res) => {
    try {
        const periods = ['today', 'week', 'month', 'year'];
        const queries = [];

        for (const p of periods) {
            const f = buildDateFilter(p);
            queries.push(`SELECT COUNT(*) as entries, COALESCE(SUM(total_alterations),0) as total_done, COALESCE(SUM(amount_received),0) as total_amount FROM alterations WHERE 1=1 ${f}`);
        }
        // All time
        queries.push(`SELECT COUNT(*) as entries, COALESCE(SUM(total_alterations),0) as total_done, COALESCE(SUM(amount_received),0) as total_amount FROM alterations`);
        // Today's date from DB
        queries.push(`SELECT date('now', 'localtime') as today`);

        const results = await db.batch(queries, 'read');

        const mapRow = (row) => ({
            entries: Number(row?.entries || 0),
            total_done: Number(row?.total_done || 0),
            total_amount: Number(row?.total_amount || 0),
        });

        res.json({
            today_date: results[5].rows[0]?.today || new Date().toISOString().split('T')[0],
            today: mapRow(results[0].rows[0]),
            week: mapRow(results[1].rows[0]),
            month: mapRow(results[2].rows[0]),
            year: mapRow(results[3].rows[0]),
            alltime: mapRow(results[4].rows[0]),
        });
    } catch (err) {
        console.error('[Alterations] dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/alterations ─────────────────────────────────────────────────────
// Returns all alteration records, optionally filtered by period
router.get('/', async (req, res) => {
    try {
        const { period } = req.query;
        const f = buildDateFilter(period);
        const rs = await db.execute({
            sql: `SELECT * FROM alterations WHERE 1=1 ${f} ORDER BY date DESC, id DESC`,
            args: []
        });
        res.json(rs.rows);
    } catch (err) {
        console.error('[Alterations] list error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/alterations ────────────────────────────────────────────────────
// Add a new alteration record
router.post('/', async (req, res) => {
    try {
        const { date, total_alterations, amount_received, description } = req.body;

        if (!date) return res.status(400).json({ error: 'date is required' });
        if (total_alterations === undefined || total_alterations === null || total_alterations === '')
            return res.status(400).json({ error: 'total_alterations is required' });
        if (amount_received === undefined || amount_received === null || amount_received === '')
            return res.status(400).json({ error: 'amount_received is required' });

        const rs = await db.execute({
            sql: `INSERT INTO alterations (date, total_alterations, amount_received, description) VALUES (?, ?, ?, ?)`,
            args: [
                date,
                parseInt(total_alterations) || 0,
                parseFloat(amount_received) || 0,
                description || null
            ]
        });

        const newId = Number(rs.lastInsertRowid);
        // Return the newly created row
        const row = await db.execute({ sql: 'SELECT * FROM alterations WHERE id = ?', args: [newId] });
        res.status(201).json(row.rows[0]);
    } catch (err) {
        console.error('[Alterations] create error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/alterations/:id ──────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM alterations WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (err) {
        console.error('[Alterations] delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── PUT /api/alterations/:id ─────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { date, total_alterations, amount_received, description } = req.body;
        await db.execute({
            sql: `UPDATE alterations SET date=?, total_alterations=?, amount_received=?, description=? WHERE id=?`,
            args: [date, parseInt(total_alterations) || 0, parseFloat(amount_received) || 0, description || null, req.params.id]
        });
        const row = await db.execute({ sql: 'SELECT * FROM alterations WHERE id = ?', args: [req.params.id] });
        res.json(row.rows[0]);
    } catch (err) {
        console.error('[Alterations] update error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
