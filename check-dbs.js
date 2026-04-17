const { createClient } = require('@libsql/client');

async function check(name) {
    const db = createClient({ url: `file:./server/${name}` });
    try {
        const rs = await db.execute('SELECT count(*) as count FROM orders');
        console.log(`${name}: ${rs.rows[0].count} orders`);
    } catch (e) {
        console.log(`${name}: error - ${e.message}`);
    }
}

async function run() {
    await check('test.db');
    await check('lm_tailor.db');
}

run();
