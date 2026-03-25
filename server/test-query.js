const { db } = require('./db');

async function testQuery() {
    const id = 22; // Customer #22 (Abhinav)
    try {
        const rs = await db.execute({
            sql: `SELECT c.*, m.length as m_length, m.shoulder, m.chest, m.waist, m.dot,
                  m.back_neck, m.front_neck, m.sleeves_length, m.armhole, m.chest_distance, m.sleeves_round,
                  m.t_length, m.t_shoulder, m.t_chest, m.t_waist, m.t_back_neck, m.t_front_neck, m.t_sleeves_length, m.t_sleeves_round, m.t_half_body, m.t_hip,
                  m.b_length, m.b_bottom_round, m.b_hip, m.b_fly, m.b_thai, m.b_knee
                  FROM customers c LEFT JOIN measurements m ON m.customer_id = c.id
                  WHERE c.id = ?`,
            args: [id]
        });

        console.log('QUERY RESULT:', JSON.stringify(rs.rows[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error('QUERY ERROR:', err.message);
        process.exit(1);
    }
}

testQuery();
