// sync-turso-to-sheets.js
require('dotenv').config();
const { createClient } = require('@libsql/client');
const { syncOrdersToSheet } = require('./sheets');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Orders';

// Use Turso Cloud DB
const url = "libsql://lm-tailor-db-kishanmagaji.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzI4MTIzMjcsImlkIjoiMDE5Y2MzZDgtZDMwMS03NTJkLWIyZjEtOTdiMGM1ZTRkODc2IiwicmlkIjoiMTJlZGVjZGQtYmZhMy00ZDhmLWFhOTgtN2NiNDA4MDdhN2U2In0.gVqmcn4sRplpeQTRr8EkQuDH8e7pi8CcK3igelGBiFxZrhOkfTGL1YSrvf7A835IGBRfIE4WQDXKaBJD_b3rDA";

const db = createClient({ url, authToken });

async function run() {
    console.log('🚀 Starting Full Sync from TURSO to Google Sheets...');
    
    // 1. Fetch ALL orders from Turso
    const ordersRs = await db.execute(`
        SELECT o.*, c.name as customer_name, c.phone_number 
        FROM orders o 
        JOIN customers c ON c.id = o.customer_id 
        ORDER BY o.order_id ASC
    `);
    
    const orders = ordersRs.rows;
    console.log(`📦 Found ${orders.length} orders in Turso.`);

    const fullOrderData = [];

    // 2. Fetch services and measurements for each order
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        const svcRs = await db.execute({
            sql: 'SELECT * FROM services WHERE order_id = ?',
            args: [order.order_id]
        });
        order.services = svcRs.rows;

        const measRs = await db.execute({
            sql: 'SELECT * FROM measurements WHERE customer_id = ?',
            args: [order.customer_id]
        });
        order.measurements = measRs.rows[0] || {};
        fullOrderData.push(order);
        process.stdout.write('.');
    }
    console.log('\n✅ Data prepared.');

    // 3. Clear Sheet (keep header)
    const { google } = require('googleapis');
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    const key = JSON.parse(keyJson);
    const auth = new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('🧹 Wiping Google Sheet...');
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A2:Z10000`,
    });

    // 4. Batch Sync
    console.log('✍️ Syncing to Google Sheets...');
    await syncOrdersToSheet(fullOrderData);

    console.log('🎉 Full Sync Complete! Synchronized', orders.length, 'orders from Turso.');
    process.exit(0);
}

run().catch(e => {
    console.error('❌ Sync failed:', e.message);
    process.exit(1);
});
