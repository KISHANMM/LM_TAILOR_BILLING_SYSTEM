const express = require('express');
const router = express.Router();
const { db, isLocal } = require('../db');
const { appendOrderToSheet } = require('../sheets');

// POST /api/orders
router.post('/', async (req, res) => {
    try {
        const { 
            customer_id, customer,  // Can pass either id or full customer object
            booking_date, delivery_date, advance_paid, notes, 
            services, measurement_type, assigned_worker, 
            stitching_expense, payment_method,
            measurements, images, audio_data, recordingTime
        } = req.body;

        if ((!customer_id && (!customer || !customer.name || !customer.phone_number)) || !booking_date || !delivery_date)
            return res.status(400).json({ error: 'Customer info, booking_date, delivery_date are required' });
        if (!services || services.length === 0)
            return res.status(400).json({ error: 'At least one service required' });

        let cid = customer_id;
        
        // 1. Resolve Customer if needed
        if (!cid && customer) {
            const existingRs = await db.execute({
                sql: 'SELECT id FROM customers WHERE phone_number = ?',
                args: [customer.phone_number]
            });
            if (existingRs.rows.length > 0) {
                cid = existingRs.rows[0].id;
            } else {
                const insertRs = await db.execute({
                    sql: 'INSERT INTO customers (name, phone_number) VALUES (?, ?)',
                    args: [customer.name, customer.phone_number]
                });
                cid = Number(insertRs.lastInsertRowid);
            }
        }

        // 2. Prepare Batch Operations
        const total_amount = services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
        const advance = parseFloat(advance_paid) || 0;
        const balance_amount = total_amount - advance;

        // 3. Duplicate Guard — reject if same customer+delivery_date+total was inserted within 30s
        const dupCheck = await db.execute({
            sql: `SELECT order_id FROM orders 
                  WHERE customer_id = ? AND delivery_date = ? AND total_amount = ?
                  AND created_at >= datetime('now', '-30 seconds', 'localtime')
                  ORDER BY order_id DESC LIMIT 1`,
            args: [cid, delivery_date, total_amount]
        });
        if (dupCheck.rows.length > 0) {
            // Return the existing order instead of creating a duplicate
            const existingId = Number(dupCheck.rows[0].order_id);
            return res.status(200).json({ order_id: existingId, total_amount, advance_paid: advance, balance_amount, duplicate: true });
        }

        // Save/Update measurements if provided (SELECT then INSERT or UPDATE to avoid ON CONFLICT dependency)
        if (measurements && Object.keys(measurements).length > 0) {
            try {
                const m = measurements;
                const mArgs = [
                    parseFloat(m.length || m.m_length) || null, parseFloat(m.shoulder) || null, parseFloat(m.chest) || null,
                    parseFloat(m.waist) || null, parseFloat(m.dot) || null, parseFloat(m.back_neck) || null,
                    parseFloat(m.front_neck) || null, parseFloat(m.sleeves_length) || null, parseFloat(m.armhole) || null,
                    parseFloat(m.chest_distance) || null, parseFloat(m.sleeves_round) || null,
                    parseFloat(m.t_length) || null, parseFloat(m.t_shoulder) || null, parseFloat(m.t_chest) || null,
                    parseFloat(m.t_waist) || null, parseFloat(m.t_back_neck) || null, parseFloat(m.t_front_neck) || null,
                    parseFloat(m.t_sleeves_length) || null, parseFloat(m.t_sleeves_round) || null, parseFloat(m.t_half_body) || null, parseFloat(m.t_hip) || null,
                    parseFloat(m.b_length) || null, parseFloat(m.b_bottom_round) || null, parseFloat(m.b_hip) || null,
                    parseFloat(m.b_fly) || null, parseFloat(m.b_thai) || null, parseFloat(m.b_knee) || null
                ];

                const existingM = await db.execute({
                    sql: 'SELECT id FROM measurements WHERE customer_id = ? LIMIT 1',
                    args: [cid]
                });

                if (existingM.rows.length > 0) {
                    await db.execute({
                        sql: `UPDATE measurements SET 
                              length=?, shoulder=?, chest=?, waist=?, dot=?, back_neck=?, front_neck=?, sleeves_length=?, armhole=?, chest_distance=?, sleeves_round=?,
                              t_length=?, t_shoulder=?, t_chest=?, t_waist=?, t_back_neck=?, t_front_neck=?, t_sleeves_length=?, t_sleeves_round=?, t_half_body=?, t_hip=?,
                              b_length=?, b_bottom_round=?, b_hip=?, b_fly=?, b_thai=?, b_knee=?,
                              updated_at=datetime('now','localtime')
                              WHERE customer_id=?`,
                        args: [...mArgs, cid]
                    });
                } else {
                    await db.execute({
                        sql: `INSERT INTO measurements (
                                customer_id, length, shoulder, chest, waist, dot, back_neck, front_neck, sleeves_length, armhole, chest_distance, sleeves_round,
                                t_length, t_shoulder, t_chest, t_waist, t_back_neck, t_front_neck, t_sleeves_length, t_sleeves_round, t_half_body, t_hip,
                                b_length, b_bottom_round, b_hip, b_fly, b_thai, b_knee
                              )
                              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                        args: [cid, ...mArgs]
                    });
                }
            } catch (measErr) {
                console.error('Measurement save error (non-fatal):', measErr.message);
            }
        }

        // Insert Order
        const orderRs = await db.execute({
            sql: `INSERT INTO orders (customer_id, booking_date, delivery_date, total_amount, advance_paid, balance_amount, notes, measurement_type, assigned_worker, stitching_expense, payment_method)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [cid, booking_date, delivery_date, total_amount, advance, balance_amount, notes || null, measurement_type || 'Body', assigned_worker || null, parseFloat(stitching_expense) || 0, payment_method || 'Cash']
        });
        const orderId = Number(orderRs.lastInsertRowid);

        const secondaryBatch = [];

        // Services
        services.forEach(svc => {
            secondaryBatch.push({
                sql: 'INSERT INTO services (order_id, service_type, quantity, price) VALUES (?, ?, ?, ?)',
                args: [orderId, svc.service_type, parseInt(svc.quantity), parseFloat(svc.price)]
            });
        });

        // Images
        if (images && Array.isArray(images)) {
            images.forEach(img => {
                secondaryBatch.push({
                    sql: 'INSERT INTO order_images (order_id, image_data) VALUES (?, ?)',
                    args: [orderId, img]
                });
            });
        }

        // Voice Note
        if (audio_data) {
            secondaryBatch.push({
                sql: 'INSERT INTO order_voice_notes (order_id, audio_data, duration) VALUES (?, ?, ?)',
                args: [orderId, audio_data, recordingTime || null]
            });
        }

        // Execute services, images, voice notes
        if (secondaryBatch.length > 0) await db.batch(secondaryBatch, "write");

        res.status(201).json({ order_id: orderId, total_amount, advance_paid: advance, balance_amount });

        // ── Google Sheets backup (non-blocking) ──────────────────────────
        // Fetch measurements for the sheet (best-effort, don't block response)
        if (!isLocal) {
            setImmediate(async () => {
                try {
                const measRs = await db.execute({
                    sql: 'SELECT * FROM measurements WHERE customer_id = ?',
                    args: [cid]
                });
                const meas = measRs.rows[0] || {};

                const custRs = await db.execute({
                    sql: 'SELECT name, phone_number FROM customers WHERE id = ?',
                    args: [cid]
                });
                const cust = custRs.rows[0] || {};

                const timeRs = await db.execute({
                    sql: 'SELECT created_at FROM orders WHERE order_id = ?',
                    args: [orderId]
                });
                const created_at = timeRs.rows[0]?.created_at || '';

                await appendOrderToSheet({
                    order_id: orderId,
                    customer_name: customer?.name || cust.name || '',
                    phone_number: customer?.phone_number || cust.phone_number || '',
                    booking_date,
                    delivery_date,
                    services: services.map(s => ({
                        service_type: s.service_type === 'Other' ? (s.custom_type || 'Other') : s.service_type,
                        quantity: parseInt(s.quantity) || 1,
                        price: parseFloat(s.price)
                    })),
                    total_amount,
                    advance_paid: advance,
                    balance_amount,
                    payment_method: payment_method || 'Cash',
                    assigned_worker: assigned_worker || '',
                    measurement_type: measurement_type || 'Body',
                    measurements: meas,
                    notes: notes || '',
                    created_at
                });
            } catch (sheetErr) {
                console.error('[Sheets] Background backup error:', sheetErr.message);
            }
        });
        }
        // ────────────────────────────────────────────────────────────────

    } catch (err) {
        console.error('Order creation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/orders
router.get('/', async (req, res) => {
    try {
        const { status, date, search, worker, sort } = req.query;
        let query = `SELECT o.*, c.name as customer_name, c.phone_number,
               m.length as m_length, m.shoulder, m.chest, m.waist, m.dot, m.back_neck, 
               m.front_neck, m.sleeves_length, m.armhole, m.chest_distance, m.sleeves_round,
               m.t_length, m.t_shoulder, m.t_chest, m.t_waist, m.t_back_neck, m.t_front_neck, m.t_sleeves_length, m.t_sleeves_round, m.t_half_body, m.t_hip,
               m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee
        FROM orders o 
        JOIN customers c ON c.id = o.customer_id 
        LEFT JOIN measurements m ON m.customer_id = c.id
        WHERE 1=1`;
        const params = [];

        if (status && status !== 'All') { query += ' AND o.status = ?'; params.push(status); }
        if (date) { query += ' AND o.delivery_date = ?'; params.push(date); }
        if (search) { query += ' AND (c.name LIKE ? OR c.phone_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
        if (worker) { query += ' AND o.assigned_worker = ?'; params.push(worker); }

        if (status === 'Pending' || status === 'Ready') {
            query += ' ORDER BY o.delivery_date ASC';
        } else {
            query += ' ORDER BY o.created_at DESC';
        }

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

// PUT /api/orders/:id/advance
router.put('/:id/advance', async (req, res) => {
    try {
        const { advance_paid } = req.body;
        if (advance_paid === undefined) {
            return res.status(400).json({ error: 'advance_paid required' });
        }

        const currentRs = await db.execute({
            sql: 'SELECT total_amount FROM orders WHERE order_id = ?',
            args: [req.params.id]
        });
        if (currentRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        
        const total_amount = currentRs.rows[0].total_amount;
        const advance = parseFloat(advance_paid) || 0;
        const balance_amount = total_amount - advance;

        await db.execute({
            sql: 'UPDATE orders SET advance_paid = ?, balance_amount = ? WHERE order_id = ?',
            args: [advance, balance_amount, req.params.id]
        });

        res.json({ success: true, total_amount, balance_amount });
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

// DELETE /api/orders/:id
router.delete('/:id', async (req, res) => {
    try {
        await db.execute({
            sql: 'DELETE FROM services WHERE order_id = ?',
            args: [req.params.id]
        });
        await db.execute({
            sql: 'DELETE FROM order_images WHERE order_id = ?',
            args: [req.params.id]
        });
        await db.execute({
            sql: 'DELETE FROM order_voice_notes WHERE order_id = ?',
            args: [req.params.id]
        });
        await db.execute({
            sql: 'DELETE FROM orders WHERE order_id = ?',
            args: [req.params.id]
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
