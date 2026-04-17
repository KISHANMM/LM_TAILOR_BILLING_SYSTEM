const { createClient } = require('@libsql/client');
require('dotenv').config();

// Hardcoded Turso credentials from the .env file I saw
const url = "libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA";

async function check() {
    const db = createClient({ url, authToken });
    try {
        const rs = await db.execute('SELECT count(*) as count FROM orders');
        console.log(`Turso: ${rs.rows[0].count} orders`);
        if (rs.rows[0].count > 0) {
            const maxId = await db.execute('SELECT max(order_id) as max_id FROM orders');
            console.log(`Turso: Max Order ID is ${maxId.rows[0].max_id}`);
        }
    } catch (e) {
        console.log(`Turso: error - ${e.message}`);
    }
}

check();
