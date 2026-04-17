const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = "libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA";

async function check() {
    const db = createClient({ url, authToken });
    try {
        const rs = await db.execute('SELECT order_id, booking_date, delivery_date FROM orders WHERE order_id >= 10 AND order_id <= 15');
        console.table(rs.rows);
    } catch (e) {
        console.log(`Turso: error - ${e.message}`);
    }
}

check();
