const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/dashboard
router.get('/', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = {};

        // 1. Due Today Orders
        const dueTodayOrdersRs = await db.execute({
            sql: `SELECT o.*, c.name as customer_name, c.phone_number FROM orders o
                  JOIN customers c ON c.id = o.customer_id
                  WHERE o.delivery_date = ? AND o.status != 'Delivered' ORDER BY o.delivery_date ASC`,
            args: [today]
        });
        result.dueTodayOrders = dueTodayOrdersRs.rows;
        result.dueToday = dueTodayOrdersRs.rows.length;

        // 2. Counts & Lists
        const pendingRs = await db.execute(`SELECT o.*, c.name as customer_name, c.phone_number FROM orders o
                                          JOIN customers c ON c.id = o.customer_id
                                          WHERE o.status = 'Pending' ORDER BY o.delivery_date ASC`);
        result.pendingOrders = pendingRs.rows;
        result.pendingCount = pendingRs.rows.length;

        const readyRs = await db.execute(`SELECT o.*, c.name as customer_name, c.phone_number FROM orders o
                                        JOIN customers c ON c.id = o.customer_id
                                        WHERE o.status = 'Ready' ORDER BY o.delivery_date ASC`);
        result.readyOrders = readyRs.rows;
        result.readyCount = readyRs.rows.length;

        const earningsRs = await db.execute("SELECT SUM(total_amount) as total FROM orders WHERE status='Delivered'");
        result.totalEarnings = Number(earningsRs.rows[0].total) || 0;

        const advanceRs = await db.execute("SELECT SUM(advance_paid) as total FROM orders WHERE status != 'Delivered'");
        result.totalAdvance = Number(advanceRs.rows[0].total) || 0;

        // 3. Recent Orders
        const recentRs = await db.execute(`SELECT o.*, c.name as customer_name, c.phone_number FROM orders o
                                          JOIN customers c ON c.id = o.customer_id
                                          ORDER BY o.created_at DESC LIMIT 10`);
        result.recentOrders = recentRs.rows;

        // 4. Totals
        const customersRs = await db.execute('SELECT COUNT(*) as count FROM customers');
        result.totalCustomers = Number(customersRs.rows[0].count) || 0;

        const ordersRs = await db.execute('SELECT COUNT(*) as count FROM orders');
        result.totalOrders = Number(ordersRs.rows[0].count) || 0;

        const overdueRs = await db.execute({
            sql: `SELECT COUNT(*) as count FROM orders WHERE delivery_date < ? AND status != 'Delivered'`,
            args: [today]
        });
        result.overdueCount = Number(overdueRs.rows[0].count) || 0;

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
