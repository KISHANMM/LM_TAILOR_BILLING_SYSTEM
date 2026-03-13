const express = require('express');
const router = express.Router();
const { db } = require('../db');

// POST /api/orders
router.post('/', async (req, res) => {
    try {
        const { customer_id, booking_date, delivery_date, advance_paid, notes, services, measurement_type, assigned_worker, stitching_expense, payment_method } = req.body;
        if (!customer_id || !booking_date || !delivery_date)
            return res.status(400).json({ error: 'customer_id, booking_date, delivery_date are required' });
        if (!services || services.length === 0)
            return res.status(400).json({ error: 'At least one service required' });

        const total_amount = services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
        const advance = parseFloat(advance_paid) || 0;
        const balance_amount = total_amount - advance;

        // Use batch for transaction-like atomic behavior
        const batchOps = [
            {
                sql: `INSERT INTO orders (customer_id, booking_date, delivery_date, total_amount, advance_paid, balance_amount, notes, measurement_type, assigned_worker, stitching_expense, payment_method)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [customer_id, booking_date, delivery_date, total_amount, advance, balance_amount, notes || null, measurement_type || 'Body', assigned_worker || null, parseFloat(stitching_expense) || 0, payment_method || 'Cash']
            }
        ];

        // We need the orderId for services, so we execute order first or use a batch trick.
        // LibSQL doesn't easily support 'last_insert_rowid()' inside a single batch for subsequent inserts as easily as sqlite3's serialize.
        // However, we can use a transaction or two steps.

        const orderRs = await db.execute(batchOps[0]);
        const orderId = Number(orderRs.lastInsertRowid);

        const serviceOps = services.map(svc => ({
            sql: 'INSERT INTO services (order_id, service_type, quantity, price) VALUES (?, ?, ?, ?)',
            args: [orderId, svc.service_type, parseInt(svc.quantity), parseFloat(svc.price)]
        }));

        await db.batch(serviceOps, "write");

        res.status(201).json({ order_id: orderId, total_amount, advance_paid: advance, balance_amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders
router.get('/', async (req, res) => {
    try {
        const { status, date, search, worker } = req.query;
        let query = `SELECT o.*, c.name as customer_name, c.phone_number, 
                           m.length as m_length, m.shoulder, m.chest, m.waist, m.dot, 
                           m.back_neck, m.front_neck, m.sleeves_length, m.armhole, 
                           m.chest_distance, m.sleeves_round
        FROM orders o 
        JOIN customers c ON c.id = o.customer_id 
        LEFT JOIN measurements m ON m.customer_id = c.id
        WHERE 1=1`;
        const params = [];

        if (status && status !== 'All') { query += ' AND o.status = ?'; params.push(status); }
        if (date) { query += ' AND o.delivery_date = ?'; params.push(date); }
        if (search) { query += ' AND (c.name LIKE ? OR c.phone_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (worker) { query += ' AND o.assigned_worker = ?'; params.push(worker); }

        query += ' ORDER BY o.created_at DESC';

        const rs = await db.execute({ sql: query, args: params });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
    try {
        const orderRs = await db.execute({
            sql: `SELECT o.*, c.name as customer_name, c.phone_number, c.id as customer_id
            FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.order_id = ?`,
            args: [req.params.id]
        });

        if (orderRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderRs.rows[0];

        const servicesRs = await db.execute({
            sql: 'SELECT * FROM services WHERE order_id = ?',
            args: [req.params.id]
        });

        res.json({ ...order, services: servicesRs.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/orders/:id/status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending', 'Ready', 'Delivered'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });

        let sql = 'UPDATE orders SET status = ? WHERE order_id = ?';
        if (status === 'Delivered') {
            // Auto-settle bill when marked delivered
            sql = 'UPDATE orders SET status = ?, advance_paid = total_amount, balance_amount = 0 WHERE order_id = ?';
        }

        await db.execute({
            sql: sql,
            args: [status, req.params.id]
        });
        res.json({ success: true, settled: status === 'Delivered' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/orders/:id/expense
router.put('/:id/expense', async (req, res) => {
    try {
        const { stitching_expense } = req.body;
        if (stitching_expense === undefined) {
            return res.status(400).json({ error: 'stitching_expense required' });
        }
        await db.execute({
            sql: 'UPDATE orders SET stitching_expense = ? WHERE order_id = ?',
            args: [parseFloat(stitching_expense) || 0, req.params.id]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res) => {
    try {
        const { booking_date, delivery_date, advance_paid, notes, services, measurement_type, assigned_worker, stitching_expense, payment_method } = req.body;

        const currentRs = await db.execute({
            sql: 'SELECT * FROM orders WHERE order_id = ?',
            args: [req.params.id]
        });
        if (currentRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = currentRs.rows[0];

        const total_amount = services
            ? services.reduce((s, sv) => s + parseFloat(sv.price) * parseInt(sv.quantity), 0)
            : order.total_amount;
        const advance = advance_paid !== undefined ? parseFloat(advance_paid) : order.advance_paid;
        const balance_amount = total_amount - advance;

        let finalStatus = order.status;
        if (balance_amount <= 0 && finalStatus !== 'Delivered') {
            finalStatus = 'Delivered';
        }

        await db.execute({
            sql: `UPDATE orders SET booking_date=?,delivery_date=?,advance_paid=?,total_amount=?,balance_amount=?,notes=?,measurement_type=?,status=?,assigned_worker=?,stitching_expense=?,payment_method=?
                WHERE order_id=?`,
            args: [
                booking_date || order.booking_date,
                delivery_date || order.delivery_date,
                advance,
                total_amount,
                balance_amount,
                notes !== undefined ? notes : order.notes,
                measurement_type || order.measurement_type,
                finalStatus,
                assigned_worker !== undefined ? assigned_worker : order.assigned_worker,
                stitching_expense !== undefined ? parseFloat(stitching_expense) : order.stitching_expense,
                payment_method || order.payment_method,
                req.params.id
            ]
        });

        if (services) {
            await db.execute({ sql: 'DELETE FROM services WHERE order_id = ?', args: [req.params.id] });
            const serviceOps = services.map(s => ({
                sql: 'INSERT INTO services (order_id, service_type, quantity, price) VALUES (?,?,?,?)',
                args: [req.params.id, s.service_type, parseInt(s.quantity), parseFloat(s.price)]
            }));
            await db.batch(serviceOps, "write");
        }

        res.json({ success: true, total_amount, balance_amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Image Attachments (Feature 2) ─────────────────────────

// GET /api/orders/:id/images
router.get('/:id/images', async (req, res) => {
    try {
        const rs = await db.execute({
            sql: 'SELECT id, image_data, created_at FROM order_images WHERE order_id = ? ORDER BY created_at DESC',
            args: [req.params.id]
        });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders/:id/images
router.post('/:id/images', async (req, res) => {
    try {
        const { images } = req.body; // array of base64 strings
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'images array required' });
        }
        const ops = images.map(img => ({
            sql: 'INSERT INTO order_images (order_id, image_data) VALUES (?, ?)',
            args: [req.params.id, img]
        }));
        await db.batch(ops, "write");
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/orders/images/:imageId
router.delete('/images/:imageId', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM order_images WHERE id = ?',
            args: [req.params.imageId]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Voice Notes (Feature 4) ─────────────────────────

// GET /api/orders/:id/voice-notes
router.get('/:id/voice-notes', async (req, res) => {
    try {
        const rs = await db.execute({
            sql: 'SELECT id, audio_data, duration, created_at FROM order_voice_notes WHERE order_id = ? ORDER BY created_at DESC',
            args: [req.params.id]
        });
        res.json(rs.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders/:id/voice-notes
router.post('/:id/voice-notes', async (req, res) => {
    try {
        const { audio_data, duration } = req.body; // base64 string
        if (!audio_data) {
            return res.status(400).json({ error: 'audio_data required' });
        }

        // We generally expect 1 voice note per order, but could be multiple.
        // For now, we just insert. If we wanted 1 max, we'd delete existing first.
        await db.execute({
            sql: 'INSERT INTO order_voice_notes (order_id, audio_data, duration) VALUES (?, ?, ?)',
            args: [req.params.id, audio_data, duration || null]
        });

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/orders/voice-notes/:noteId
router.delete('/voice-notes/:noteId', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM order_voice_notes WHERE id = ?',
            args: [req.params.noteId]
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
