const { createClient } = require('@libsql/client');
require('dotenv').config();

const url = "libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA";

async function check() {
    const db = createClient({ url, authToken });
    try {
        const rs = await db.execute('PRAGMA table_info(measurements)');
        console.table(rs.rows);
    } catch (e) {
        console.log(`Turso: error - ${e.message}`);
    }
}

check();
