const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db, isLocal } = require('../db');
const { appendOrderToSheet } = require('../sheets');

// POST /api/orders — OPTIMIZED: reduced from ~7 sequential DB calls to ~3
router.post('/', async (req, res) => {
    try {
        const { 
            customer_id, customer,  // Can pass either id or full customer object
            booking_date, delivery_date, advance_paid, notes, 
            services, measurement_type, assigned_worker, 
            stitching_expense, payment_method,
            measurements, images, audio_data, recordingTime,
            wallet_redeemed  // loyalty wallet redemption amount
        } = req.body;

        await expireWalletCredits();

        // ── Fast validation (no DB calls) ─────────────────────────────────
        if ((!customer_id && (!customer || !customer.name || !customer.phone_number)) || !booking_date || !delivery_date)
            return res.status(400).json({ error: 'Customer info, booking_date, delivery_date are required' });
        if (!services || services.length === 0)
            return res.status(400).json({ error: 'At least one service required' });

        // ── Pre-parse all numbers once (avoid repeated parseFloat in loops) ──
        const parsedServices = services.map(svc => ({
            service_type: svc.service_type,
            custom_type: svc.custom_type,
            quantity: parseInt(svc.quantity) || 1,
            price: parseFloat(svc.price) || 0,
        }));
        const total_amount = parsedServices.reduce((s, svc) => s + (svc.price * svc.quantity), 0);
        const advance = parseFloat(advance_paid) || 0;
        const walletUsed = Math.min(parseFloat(wallet_redeemed) || 0, 200);
        const balance_amount = total_amount - advance - walletUsed;
        const parsedStitchingExpense = parseFloat(stitching_expense) || 0;

        // ── Step 1: Resolve Customer (1 DB call — uses ON CONFLICT for atomic upsert) ──
        let cid = customer_id;
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

        // ── Step 2: Duplicate Guard + Order Insert (combined — 1 DB call) ──
        // Check duplicate in same query scope to avoid race conditions
        const dupCheck = await db.execute({
            sql: `SELECT order_id FROM orders 
                  WHERE customer_id = ? AND delivery_date = ? AND total_amount = ?
                  AND created_at >= datetime('now', '-30 seconds', 'localtime')
                  ORDER BY order_id DESC LIMIT 1`,
            args: [cid, delivery_date, total_amount]
        });
        if (dupCheck.rows.length > 0) {
            const existingId = Number(dupCheck.rows[0].order_id);
            return res.status(200).json({ order_id: existingId, total_amount, advance_paid: advance, balance_amount, duplicate: true });
        }

        const orderRs = await db.execute({
            sql: `INSERT INTO orders (customer_id, booking_date, delivery_date, total_amount, advance_paid, balance_amount, wallet_redeemed, notes, measurement_type, assigned_worker, stitching_expense, payment_method)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [cid, booking_date, delivery_date, total_amount, advance, balance_amount, walletUsed, notes || null, measurement_type || 'Body', assigned_worker || null, parsedStitchingExpense, payment_method || 'Cash']
        });
        const orderId = Number(orderRs.lastInsertRowid);

        // ── Step 3: Single batch for ALL remaining writes ─────────────────
        // Measurements (ON CONFLICT upsert — 1 statement instead of SELECT+INSERT/UPDATE),
        // Services, Wallet ops — all in one db.batch() call
        const batchOps = [];

        // 3a. Measurement upsert (ON CONFLICT — eliminates the SELECT + conditional INSERT/UPDATE)
        if (measurements && Object.keys(measurements).length > 0) {
            const m = measurements;
            const extra = m.extra_measurements ? (typeof m.extra_measurements === 'string' ? m.extra_measurements : JSON.stringify(m.extra_measurements)) : null;
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
            batchOps.push({
                sql: `INSERT INTO measurements (
                        customer_id, length, shoulder, chest, waist, dot, back_neck, front_neck, sleeves_length, armhole, chest_distance, sleeves_round,
                        t_length, t_shoulder, t_chest, t_waist, t_back_neck, t_front_neck, t_sleeves_length, t_sleeves_round, t_half_body, t_hip,
                        b_length, b_bottom_round, b_hip, b_fly, b_thai, b_knee, extra_measurements
                      )
                      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(customer_id) DO UPDATE SET
                        length=excluded.length, shoulder=excluded.shoulder, chest=excluded.chest,
                        waist=excluded.waist, dot=excluded.dot, back_neck=excluded.back_neck,
                        front_neck=excluded.front_neck, sleeves_length=excluded.sleeves_length,
                        armhole=excluded.armhole, chest_distance=excluded.chest_distance, sleeves_round=excluded.sleeves_round,
                        t_length=excluded.t_length, t_shoulder=excluded.t_shoulder, t_chest=excluded.t_chest,
                        t_waist=excluded.t_waist, t_back_neck=excluded.t_back_neck, t_front_neck=excluded.t_front_neck,
                        t_sleeves_length=excluded.t_sleeves_length, t_sleeves_round=excluded.t_sleeves_round,
                        t_half_body=excluded.t_half_body, t_hip=excluded.t_hip,
                        b_length=excluded.b_length, b_bottom_round=excluded.b_bottom_round, b_hip=excluded.b_hip,
                        b_fly=excluded.b_fly, b_thai=excluded.b_thai, b_knee=excluded.b_knee,
                        extra_measurements=excluded.extra_measurements,
                        updated_at=datetime('now','localtime')`,
                args: [cid, ...mArgs, extra]
            });
        }

        // 3b. Services (pre-parsed numbers — no parseFloat in loop)
        for (const svc of parsedServices) {
            batchOps.push({
                sql: 'INSERT INTO services (order_id, service_type, quantity, price) VALUES (?, ?, ?, ?)',
                args: [orderId, svc.service_type, svc.quantity, svc.price]
            });
        }

        // 3c. Wallet debit (included in same batch instead of separate awaits)
        if (walletUsed > 0) {
            batchOps.push({
                sql: 'UPDATE customers SET wallet_balance = MAX(0, wallet_balance - ?) WHERE id = ?',
                args: [walletUsed, cid]
            });
            batchOps.push({
                sql: 'INSERT INTO wallet_transactions (customer_id, order_id, type, amount, description) VALUES (?, ?, ?, ?, ?)',
                args: [cid, orderId, 'DEBIT', walletUsed, `Wallet redeemed on Order #${orderId}`]
            });
            let remainingToSpend = walletUsed;
            const credits = await db.execute({ sql: `SELECT credit_id, remaining_amount FROM wallet_credit_balances WHERE customer_id=? AND remaining_amount>0 AND expires_at>datetime('now','localtime') ORDER BY expires_at, credit_id`, args: [cid] });
            for (const credit of credits.rows) {
                if (remainingToSpend <= 0) break;
                const spent = Math.min(remainingToSpend, credit.remaining_amount);
                batchOps.push({ sql: 'UPDATE wallet_credit_balances SET remaining_amount=MAX(0,remaining_amount-?) WHERE credit_id=?', args: [spent, credit.credit_id] });
                remainingToSpend -= spent;
            }
        }

        // Execute the entire batch in one round-trip
        if (batchOps.length > 0) await db.batch(batchOps, "write");

        // ── Respond IMMEDIATELY — images/audio saved in background ────────
        res.status(201).json({ order_id: orderId, total_amount, advance_paid: advance, balance_amount, wallet_redeemed: walletUsed });

        // ── Background: Save images & audio (non-blocking, after response) ──
        setImmediate(async () => {
            try {
                const mediaBatch = [];
                if (images && Array.isArray(images) && images.length > 0) {
                    for (const img of images) {
                        const imgData = typeof img === 'object' ? img.data : img;
                        const imgType = typeof img === 'object' ? (img.type || 'photo') : 'photo';
                        mediaBatch.push({
                            sql: 'INSERT INTO order_images (order_id, image_data, image_type) VALUES (?, ?, ?)',
                            args: [orderId, imgData, imgType]
                        });
                    }
                }
                if (audio_data) {
                    mediaBatch.push({
                        sql: 'INSERT INTO order_voice_notes (order_id, audio_data, duration) VALUES (?, ?, ?)',
                        args: [orderId, audio_data, recordingTime || null]
                    });
                }
                if (mediaBatch.length > 0) await db.batch(mediaBatch, "write");
            } catch (mediaErr) {
                console.error('[Media] Background save error:', mediaErr.message);
            }
        });
        // NOTE: Cashback (3% capped at ₹200) is credited ONLY when order is marked Delivered.

        // ── Google Sheets backup (non-blocking) ──────────────────────────
        if (!isLocal) {
            setImmediate(async () => {
                try {
                const measRs = await db.execute({
                    sql: 'SELECT *, length AS m_length FROM measurements WHERE customer_id = ?',
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
                    services: parsedServices.map(s => ({
                        service_type: s.service_type === 'Other' ? (s.custom_type || 'Other') : s.service_type,
                        quantity: s.quantity,
                        price: s.price
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
        } // end if (!isLocal)
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
               m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee, m.extra_measurements
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

// ── Cashback helper — idempotent, capped at ₹200 ────────────────────
// Credits 5% cashback (max ₹200) when an order is first delivered.
// Safe to call multiple times — skips if a CREDIT already exists for this order.
async function creditCashbackForOrder(orderId) {
    try {
        const orderRs = await db.execute({
            sql: 'SELECT customer_id, total_amount FROM orders WHERE order_id = ?',
            args: [orderId]
        });
        if (orderRs.rows.length === 0) return;
        const { customer_id, total_amount } = orderRs.rows[0];

        // Idempotency check — skip if already credited
        const already = await db.execute({
            sql: `SELECT id FROM wallet_transactions WHERE order_id = ? AND type = 'CREDIT' LIMIT 1`,
            args: [orderId]
        });
        if (already.rows.length > 0) return;

        const cashback = Math.min(
            parseFloat((parseFloat(total_amount) * 0.03).toFixed(2)),
            200
        );
        if (cashback <= 0) return;

        const creditRs = await db.execute({
            sql: `INSERT INTO wallet_transactions (customer_id, order_id, type, amount, description, expires_at) VALUES (?, ?, 'CREDIT', ?, ?, datetime('now', '+2 months', 'localtime')) RETURNING id, expires_at`,
            args: [customer_id, orderId, cashback, `3% cashback on Order #${orderId} (max ₹200)`]
        });
        await db.batch([
            { sql: 'INSERT INTO wallet_credit_balances (credit_id, customer_id, remaining_amount, expires_at) VALUES (?, ?, ?, ?)', args: [creditRs.rows[0].id, customer_id, cashback, creditRs.rows[0].expires_at] },
            { sql: 'UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', args: [cashback, customer_id] }
        ], 'write');
        console.log(`🪙 Cashback ₹${cashback} credited for Order #${orderId}`);
    } catch (err) {
        console.error('creditCashbackForOrder error:', err.message);
    }
}

async function expireWalletCredits() {
    const expired = await db.execute({ sql: `SELECT customer_id, SUM(remaining_amount) AS amount FROM wallet_credit_balances WHERE remaining_amount>0 AND expires_at<=datetime('now','localtime') GROUP BY customer_id` });
    for (const row of expired.rows) {
        await db.execute({ sql: 'UPDATE customers SET wallet_balance=MAX(0,wallet_balance-?) WHERE id=?', args: [row.amount, row.customer_id] });
    }
    await db.execute({ sql: `UPDATE wallet_credit_balances SET remaining_amount=0 WHERE expires_at<=datetime('now','localtime') AND remaining_amount>0` });
}

// PUT /api/orders/:id/status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending', 'Ready', 'Delivered'].includes(status))
            return res.status(400).json({ error: 'Invalid status' });

        const current = await db.execute({ sql: 'SELECT total_amount, advance_paid, wallet_redeemed FROM orders WHERE order_id = ?', args: [req.params.id] });
        if (!current.rows.length) return res.status(404).json({ error: 'Order not found' });
        const order = current.rows[0];
        const balance = status === 'Delivered' ? 0 : Math.max(0, order.total_amount - order.advance_paid - (order.wallet_redeemed || 0));
        await db.execute({
            sql: `UPDATE orders SET status = ?, balance_amount = ?, delivered_at = ${status === 'Delivered' ? "COALESCE(delivered_at, datetime('now', 'localtime'))" : 'NULL'} WHERE order_id = ?`,
            args: [status, balance, req.params.id]
        });

        // Credit cashback when first marked Delivered
        if (status === 'Delivered') {
            await creditCashbackForOrder(req.params.id);
        }

        res.json({ success: true, settled: status === 'Delivered', advance_paid: order.advance_paid, balance_amount: balance });
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
            sql: 'SELECT total_amount, wallet_redeemed FROM orders WHERE order_id = ?',
            args: [req.params.id]
        });
        if (currentRs.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        
        const total_amount = currentRs.rows[0].total_amount;
        const walletUsed = currentRs.rows[0].wallet_redeemed || 0;
        const advance = parseFloat(advance_paid) || 0;
        const balance_amount = Math.max(0, total_amount - advance - walletUsed);

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
        const walletUsed = order.wallet_redeemed || 0;
        const balance_amount = Math.max(0, total_amount - advance - walletUsed);

        let finalStatus = order.status;
        if (balance_amount <= 0 && finalStatus !== 'Delivered') {
            finalStatus = 'Delivered';
        }

        let deliveredAtSql = '';
        if (finalStatus === 'Delivered') {
            deliveredAtSql = `, delivered_at = COALESCE(delivered_at, datetime('now', 'localtime'))`;
        } else {
            deliveredAtSql = `, delivered_at = NULL`;
        }

        await db.execute({
            sql: `UPDATE orders SET booking_date=?,delivery_date=?,advance_paid=?,total_amount=?,balance_amount=?,notes=?,measurement_type=?,status=?,assigned_worker=?,stitching_expense=?,payment_method=? ${deliveredAtSql}
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

        // Credit cashback if order just became Delivered (e.g. balance fully paid)
        if (finalStatus === 'Delivered' && order.status !== 'Delivered') {
            await creditCashbackForOrder(req.params.id);
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
            sql: 'SELECT id, image_data, image_type, created_at FROM order_images WHERE order_id = ? ORDER BY created_at DESC',
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
        const { images } = req.body; // array of base64 strings OR {data, type} objects
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ error: 'images array required' });
        }
        const ops = images.map(img => {
            const imgData = typeof img === 'object' ? img.data : img;
            const imgType = typeof img === 'object' ? (img.type || 'photo') : 'photo';
            return {
                sql: 'INSERT INTO order_images (order_id, image_data, image_type) VALUES (?, ?, ?)',
                args: [req.params.id, imgData, imgType]
            };
        });
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
        const { password } = req.body || {};
        const adminPass = process.env.ADMIN_PASSWORD || 'LataMagaji';

        if (!password) {
            return res.json({ success: false, error: 'Password is required to delete an order.' });
        }

        const passBuf = Buffer.from(String(password));
        const adminBuf = Buffer.from(String(adminPass));
        let match = false;
        if (passBuf.length === adminBuf.length) {
            match = crypto.timingSafeEqual(passBuf, adminBuf);
        }

        if (!match) {
            return res.json({ success: false, error: 'Incorrect password. Deletion aborted.' });
        }

        const id = Number(req.params.id);
        const orderRs = await db.execute({ sql: `SELECT o.*, c.name AS customer_name, c.phone_number FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.order_id=?`, args: [id] });
        if (!orderRs.rows.length) return res.status(404).json({ error: 'Order not found' });
        const order = orderRs.rows[0];
        const [services, images, voiceNotes, measurements] = await Promise.all([
            db.execute({ sql: 'SELECT * FROM services WHERE order_id=?', args: [id] }),
            db.execute({ sql: 'SELECT * FROM order_images WHERE order_id=?', args: [id] }),
            db.execute({ sql: 'SELECT * FROM order_voice_notes WHERE order_id=?', args: [id] }),
            db.execute({ sql: 'SELECT * FROM measurements WHERE customer_id=?', args: [order.customer_id] })
        ]);
        const snapshot = { order, services: services.rows, images: images.rows, voiceNotes: voiceNotes.rows, measurements: measurements.rows[0] || null };
        await db.execute({ sql: 'INSERT INTO deleted_orders (order_id, snapshot) VALUES (?, ?)', args: [id, JSON.stringify(snapshot)] });
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
        
        res.json({ success: true, message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Recycle bin: deleted orders are retained for 10 days.
router.get('/deleted/list', async (_req, res) => {
    try {
        await db.execute("DELETE FROM deleted_orders WHERE deleted_at <= datetime('now', '-10 days', 'localtime')");
        const rs = await db.execute("SELECT id, order_id, deleted_at, snapshot FROM deleted_orders ORDER BY deleted_at DESC");
        res.json(rs.rows.map(row => ({ id: row.id, order_id: row.order_id, deleted_at: row.deleted_at, ...JSON.parse(row.snapshot) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deleted/:id/restore', async (req, res) => {
    try {
        const rs = await db.execute({ sql: "SELECT * FROM deleted_orders WHERE id=? AND deleted_at > datetime('now', '-10 days', 'localtime')", args: [req.params.id] });
        if (!rs.rows.length) return res.status(404).json({ error: 'Deleted order not found or retention period expired' });
        const snapshot = JSON.parse(rs.rows[0].snapshot);
        const order = snapshot.order;
        const cust = await db.execute({ sql: 'SELECT id FROM customers WHERE id=?', args: [order.customer_id] });
        let customerId = order.customer_id;
        if (!cust.rows.length) {
            const restoredCustomer = await db.execute({ sql: 'INSERT INTO customers (name, phone_number) VALUES (?, ?) RETURNING id', args: [order.customer_name, order.phone_number] });
            customerId = restoredCustomer.rows[0].id;
        }
        const cols = Object.keys(order).filter(k => !['order_id', 'customer_name', 'phone_number'].includes(k));
        const values = cols.map(k => k === 'customer_id' ? customerId : order[k]);
        await db.execute({ sql: `INSERT INTO orders (order_id, ${cols.join(',')}) VALUES (?,${cols.map(() => '?').join(',')})`, args: [order.order_id, ...values] });
        for (const service of snapshot.services) await db.execute({ sql: 'INSERT INTO services (order_id, service_type, quantity, price) VALUES (?,?,?,?)', args: [order.order_id, service.service_type, service.quantity, service.price] });
        for (const image of snapshot.images) await db.execute({ sql: 'INSERT INTO order_images (order_id, image_data, image_type, created_at) VALUES (?,?,?,?)', args: [order.order_id, image.image_data, image.image_type || 'photo', image.created_at] });
        for (const note of snapshot.voiceNotes) await db.execute({ sql: 'INSERT INTO order_voice_notes (order_id, audio_data, duration, created_at) VALUES (?,?,?,?)', args: [order.order_id, note.audio_data, note.duration, note.created_at] });
        if (snapshot.measurements) {
            const m = snapshot.measurements;
            const mcols = Object.keys(m).filter(k => k !== 'id');
            const mvals = mcols.map(k => k === 'customer_id' ? customerId : m[k]);
            await db.execute({ sql: `INSERT INTO measurements (${mcols.join(',')}) VALUES (${mcols.map(() => '?').join(',')}) ON CONFLICT(customer_id) DO UPDATE SET ${mcols.filter(k => !['customer_id','updated_at'].includes(k)).map(k => `${k}=excluded.${k}`).join(',')}`, args: mvals });
        }
        await db.execute({ sql: 'DELETE FROM deleted_orders WHERE id=?', args: [req.params.id] });
        res.json({ success: true, order_id: order.order_id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
