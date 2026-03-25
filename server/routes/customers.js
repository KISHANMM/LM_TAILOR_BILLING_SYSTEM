const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET /api/customers/search?phone=... or ?name=...
router.get('/search', async (req, res) => {
    try {
        const { phone, name } = req.query;
        let query, param;

        if (phone) {
            query = `SELECT c.*, m.length as m_length, m.shoulder, m.chest, m.waist, m.dot,
                 m.back_neck, m.front_neck, m.sleeves_length, m.armhole, m.chest_distance, m.sleeves_round,
                 m.t_length, m.t_shoulder, m.t_chest, m.t_waist, m.t_back_neck, m.t_front_neck, m.t_sleeves_length, m.t_sleeves_round, m.t_half_body, m.t_hip,
                 m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee
                 FROM customers c LEFT JOIN measurements m ON m.customer_id = c.id
                 WHERE c.phone_number LIKE ? GROUP BY c.id LIMIT 20`;
            param = `%${phone}%`;
        } else if (name) {
            query = `SELECT c.*, m.length as m_length, m.shoulder, m.chest, m.waist, m.dot,
                 m.back_neck, m.front_neck, m.sleeves_length, m.armhole, m.chest_distance, m.sleeves_round,
                 m.t_length, m.t_shoulder, m.t_chest, m.t_waist, m.t_back_neck, m.t_front_neck, m.t_sleeves_length, m.t_sleeves_round, m.t_half_body, m.t_hip,
                 m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee
                 FROM customers c LEFT JOIN measurements m ON m.customer_id = c.id
                 WHERE c.name LIKE ? GROUP BY c.id LIMIT 20`;
            param = `%${name}%`;
        } else {
            return res.json([]);
        }

        const rs = await db.execute({ sql: query, args: [param] });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const rs = await db.execute({
            sql: `SELECT c.*, m.length as m_length, m.shoulder, m.chest, m.waist, m.dot,
                  m.back_neck, m.front_neck, m.sleeves_length, m.armhole, m.chest_distance, m.sleeves_round,
                  m.t_length, m.t_shoulder, m.t_chest, m.t_waist, m.t_back_neck, m.t_front_neck, m.t_sleeves_length, m.t_sleeves_round, m.t_half_body, m.t_hip,
                  m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee
                  FROM customers c LEFT JOIN measurements m ON m.customer_id = c.id
                  WHERE c.id = ?`,
            args: [id]
        });

        if (rs.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
        const customer = rs.rows[0];

        const ordersRs = await db.execute({
            sql: `SELECT o.*, (SELECT COUNT(*) FROM services WHERE order_id = o.order_id) as service_count
                  FROM orders o WHERE o.customer_id = ? ORDER BY o.created_at DESC`,
            args: [id]
        });

        res.json({ ...customer, orders: ordersRs.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper for measurements upsert in LibSQL
async function upsertMeasurements(customerId, measurements) {
    if (!measurements || Object.keys(measurements).length === 0) return;
    const { 
        m_length, length, shoulder, chest, waist, dot, back_neck, front_neck, sleeves_length, armhole, chest_distance, sleeves_round,
        t_length, t_shoulder, t_chest, t_waist, t_back_neck, t_front_neck, t_sleeves_length, t_sleeves_round, t_half_body, t_hip,
        b_length, b_bottom_round, b_hip, b_fly, b_thai, b_knee
    } = measurements;

    // Normalize length key (accept both m_length and length)
    const activeLength = m_length !== undefined ? m_length : length;

    const existM = await db.execute({
        sql: 'SELECT id FROM measurements WHERE customer_id = ?',
        args: [customerId]
    });

    if (existM.rows.length > 0) {
        await db.execute({
            sql: `UPDATE measurements SET length=?,shoulder=?,chest=?,waist=?,dot=?,
                  back_neck=?,front_neck=?,sleeves_length=?,armhole=?,chest_distance=?,sleeves_round=?,
                  t_length=?, t_shoulder=?, t_chest=?, t_waist=?, t_back_neck=?, t_front_neck=?, t_sleeves_length=?, t_sleeves_round=?, t_half_body=?, t_hip=?,
                  b_length=?, b_bottom_round=?, b_hip=?, b_fly=?, b_thai=?, b_knee=?,
                  updated_at=datetime('now','localtime') WHERE customer_id=?`,
            args: [
                parseFloat(activeLength) || null, parseFloat(shoulder) || null, parseFloat(chest) || null,
                parseFloat(waist) || null, parseFloat(dot) || null, parseFloat(back_neck) || null,
                parseFloat(front_neck) || null, parseFloat(sleeves_length) || null, parseFloat(armhole) || null,
                parseFloat(chest_distance) || null, parseFloat(sleeves_round) || null,
                parseFloat(t_length) || null, parseFloat(t_shoulder) || null, parseFloat(t_chest) || null,
                parseFloat(t_waist) || null, parseFloat(t_back_neck) || null, parseFloat(t_front_neck) || null,
                parseFloat(t_sleeves_length) || null, parseFloat(t_sleeves_round) || null, parseFloat(t_half_body) || null, parseFloat(t_hip) || null,
                parseFloat(b_length) || null, parseFloat(b_bottom_round) || null, parseFloat(b_hip) || null,
                parseFloat(b_fly) || null, parseFloat(b_thai) || null, parseFloat(b_knee) || null,
                customerId
            ]
        });
    } else {
        await db.execute({
            sql: `INSERT INTO measurements (
                    customer_id,length,shoulder,chest,waist,dot,back_neck,front_neck,sleeves_length,armhole,chest_distance,sleeves_round,
                    t_length, t_shoulder, t_chest, t_waist, t_back_neck, t_front_neck, t_sleeves_length, t_sleeves_round, t_half_body, t_hip,
                    b_length, b_bottom_round, b_hip, b_fly, b_thai, b_knee
                  )
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [
                customerId,
                parseFloat(activeLength) || null, parseFloat(shoulder) || null, parseFloat(chest) || null,
                parseFloat(waist) || null, parseFloat(dot) || null, parseFloat(back_neck) || null,
                parseFloat(front_neck) || null, parseFloat(sleeves_length) || null, parseFloat(armhole) || null, parseFloat(chest_distance) || null, parseFloat(sleeves_round) || null,
                parseFloat(t_length) || null, parseFloat(t_shoulder) || null, parseFloat(t_chest) || null,
                parseFloat(t_waist) || null, parseFloat(t_back_neck) || null, parseFloat(t_front_neck) || null,
                parseFloat(t_sleeves_length) || null, parseFloat(t_sleeves_round) || null, parseFloat(t_half_body) || null, parseFloat(t_hip) || null,
                parseFloat(b_length) || null, parseFloat(b_bottom_round) || null, parseFloat(b_hip) || null,
                parseFloat(b_fly) || null, parseFloat(b_thai) || null, parseFloat(b_knee) || null
            ]
        });
    }
}

// POST /api/customers
router.post('/', async (req, res) => {
    try {
        const { name, phone_number, measurements } = req.body;
        if (!name || !phone_number) return res.status(400).json({ error: 'Name and phone number required' });

        const existingRs = await db.execute({
            sql: 'SELECT * FROM customers WHERE phone_number = ?',
            args: [phone_number]
        });

        if (existingRs.rows.length > 0) {
            const existing = existingRs.rows[0];
            await upsertMeasurements(existing.id, measurements);
            return res.status(200).json(existing);
        }

        const insertRs = await db.execute({
            sql: 'INSERT INTO customers (name, phone_number) VALUES (?, ?)',
            args: [name, phone_number]
        });

        const newId = Number(insertRs.lastInsertRowid);
        await upsertMeasurements(newId, measurements);

        const rowRs = await db.execute({
            sql: 'SELECT * FROM customers WHERE id = ?',
            args: [newId]
        });
        res.status(201).json(rowRs.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/customers/:id/measurements
router.put('/:id/measurements', async (req, res) => {
    try {
        await upsertMeasurements(req.params.id, req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, phone_number } = req.body;
        if (!name || !phone_number) return res.status(400).json({ error: 'Name and phone number required' });

        // Check if phone number is already taken by another customer
        const existingRs = await db.execute({
            sql: 'SELECT id FROM customers WHERE phone_number = ? AND id != ?',
            args: [phone_number, req.params.id]
        });

        if (existingRs.rows.length > 0) {
            return res.status(400).json({ error: 'Phone number already exists for another customer' });
        }

        await db.execute({
            sql: 'UPDATE customers SET name = ?, phone_number = ? WHERE id = ?',
            args: [name, phone_number, req.params.id]
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
