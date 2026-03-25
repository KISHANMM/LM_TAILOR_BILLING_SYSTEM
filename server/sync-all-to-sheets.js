// sync-all-to-sheets.js
// One-time script to wipe the Google Sheet and rewrite every order from the database
require('dotenv').config();
const { db } = require('./db');
const { google } = require('googleapis');
const { appendOrderToSheet } = require('./sheets');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Orders'; 

function getAuthClient() {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set');
    const key = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
        credentials: key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
}

async function run() {
    console.log('🚀 Starting Full Sync to Google Sheets...');
    
    // Connect to Turso
    console.log('📡 Connecting to Turso Database via environment variables...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);

    // 1. Fetch ALL orders from the database
    const ordersRs = await db.execute(`
        SELECT o.*, c.name as customer_name, c.phone_number 
        FROM orders o 
        JOIN customers c ON c.id = o.customer_id 
        ORDER BY o.order_id ASC
    `);
    
    const orders = ordersRs.rows;
    console.log(`📦 Found ${orders.length} orders in the database.`);

    // 2. Clear the existing sheet (except header)
    try {
        const auth = getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });

        console.log('🧹 Wiping existing rows from Google Sheet (keeping headers)...');
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A2:Z10000`, // Clear from row 2 downwards
        });
        console.log('✅ Sheet wiped successfully.');
    } catch (e) {
        console.error('❌ Failed to clear sheet:', e.message);
        return;
    }

    // 3. Re-insert every single order using the updated appendOrderToSheet logic
    console.log('✍️ Writing orders to sheet sequentially...');
    for (let i = 0; i < orders.length; i++) {
        const order = orders[i];
        
        // Fetch services
        const svcRs = await db.execute({
            sql: 'SELECT * FROM services WHERE order_id = ?',
            args: [order.order_id]
        });
        order.services = svcRs.rows;

        // Fetch measurements
        const measRs = await db.execute({
            sql: 'SELECT * FROM measurements WHERE customer_id = ?',
            args: [order.customer_id]
        });
        order.measurements = measRs.rows[0] || {};

        // Use append logic
        await appendOrderToSheet(order);
        
        // Slight delay to avoid hitting Google Sheets API rate limits
        await new Promise(r => setTimeout(r, 800));
    }

    console.log('🎉 Full Sync Complete! Written', orders.length, 'orders.');
    process.exit(0);
}

run().catch(e => console.error(e));
