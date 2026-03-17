const { db } = require('./db');

async function checkSchema() {
    try {
        console.log('--- Customers Schema ---');
        const customers = await db.execute('PRAGMA table_info(customers)');
        console.table(customers.rows);

        console.log('\n--- Orders Schema ---');
        const orders = await db.execute('PRAGMA table_info(orders)');
        console.table(orders.rows);

        console.log('\n--- Measurements Schema ---');
        const measurements = await db.execute('PRAGMA table_info(measurements)');
        console.table(measurements.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
