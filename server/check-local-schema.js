const { createClient } = require('@libsql/client');

async function check() {
    const db = createClient({ url: 'file:./server/test.db' });
    try {
        const rs = await db.execute('PRAGMA table_info(measurements)');
        console.table(rs.rows);
    } catch (e) {
        console.log(`test.db: error - ${e.message}`);
    }
}

check();
