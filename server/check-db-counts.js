const { createClient } = require('@libsql/client');

async function check(name) {
    const db = createClient({ url: `file:./${name}` });
    try {
        const rs = await db.execute('SELECT count(*) as count FROM orders');
        console.log(`${name}: ${rs.rows[0].count} orders`);
        if (rs.rows[0].count > 0) {
            const maxId = await db.execute('SELECT max(order_id) as max_id FROM orders');
            console.log(`${name}: Max Order ID is ${maxId.rows[0].max_id}`);
        }
    } catch (e) {
        console.log(`${name}: error - ${e.message}`);
    }
}

async function run() {
    await check('test.db');
    await check('lm_tailor.db');
}

run();
