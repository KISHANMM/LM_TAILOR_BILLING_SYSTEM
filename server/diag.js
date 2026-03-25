const { db } = require('./db');

async function diag() {
    try {
        console.log('--- Diagnostic Start ---');
        // 1. Create a dummy customer
        const phone = '9999999999';
        await db.execute({ sql: 'DELETE FROM customers WHERE phone_number = ?', args: [phone] });
        const custRs = await db.execute({
            sql: 'INSERT INTO customers (name, phone_number) VALUES (?, ?)',
            args: ['DIAG_TEST', phone]
        });
        const cid = Number(custRs.lastInsertRowid);
        console.log('✅ Created DIAG_TEST customer, ID:', cid);

        // 2. Prepare measurements (Simulate measPayload from NewOrder.jsx)
        const m = {
            m_length: 10, shoulder: 11, chest: 12, waist: 13, dot: 14, back_neck: 15, front_neck: 16, sleeves_length: 17, armhole: 18, chest_distance: 19, sleeves_round: 20,
            t_length: 30, t_shoulder: 31, t_chest: 32, t_waist: 33, t_back_neck: 34, t_front_neck: 35, t_sleeves_length: 36, t_sleeves_round: 37, t_half_body: 38, t_hip: 39,
            b_length: 40, b_bottom_round: 41, b_hip: 42, b_fly: 43, b_thai: 44, b_knee: 45
        };

        // 3. Simulate Logic from orders.js
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

        console.log('mArgs length:', mArgs.length);

        await db.execute({
            sql: `INSERT INTO measurements (
                    customer_id, length, shoulder, chest, waist, dot, back_neck, front_neck, sleeves_length, armhole, chest_distance, sleeves_round,
                    t_length, t_shoulder, t_chest, t_waist, t_back_neck, t_front_neck, t_sleeves_length, t_sleeves_round, t_half_body, t_hip,
                    b_length, b_bottom_round, b_hip, b_fly, b_thai, b_knee
                  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            args: [cid, ...mArgs]
        });
        console.log('✅ INSERT into measurements successful');

        // 4. Verify Read
        const readRs = await db.execute({
            sql: `SELECT * FROM measurements WHERE customer_id = ?`,
            args: [cid]
        });
        console.log('--- Read Results ---');
        console.log(JSON.stringify(readRs.rows[0], null, 2));

        process.exit(0);
    } catch (err) {
        console.error('❌ DIAG ERROR:', err.message);
        process.exit(1);
    }
}

diag();
