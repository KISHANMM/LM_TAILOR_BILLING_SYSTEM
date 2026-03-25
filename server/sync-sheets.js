const { db } = require('./db');
const { google } = require('googleapis');
require('dotenv').config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Orders';

async function getExistingOrderIds(sheets) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A2:A`,
        });
        const rows = response.data.values || [];
        return new Set(rows.map(row => row[0]));
    } catch (err) {
        console.error('[Sync] Error fetching existing IDs:', err.message);
        return new Set();
    }
}

async function sync() {
    if (!SHEET_ID) {
        console.error('❌ GOOGLE_SHEET_ID not set in .env');
        return;
    }

    try {
        const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        if (!keyJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
        const key = JSON.parse(keyJson);
        const auth = new google.auth.GoogleAuth({
            credentials: key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        console.log('🔄 Checking existing orders in Google Sheet...');
        const existingIds = await getExistingOrderIds(sheets);
        console.log(`📊 Found ${existingIds.size} records in Sheet.`);

        console.log('📦 Fetching orders from Database...');
        const ordersRs = await db.execute('SELECT * FROM orders ORDER BY order_id ASC');
        const orders = ordersRs.rows;
        console.log(`📂 Total orders in Database: ${orders.length}`);

        const missingOrders = orders.filter(o => {
            const sheetId = `#${String(o.order_id).padStart(4, '0')}`;
            return !existingIds.has(sheetId);
        });

        if (missingOrders.length === 0) {
            console.log('✅ No missing orders. Sheet is up to date.');
            process.exit(0);
        }

        console.log(`🚀 Syncing ${missingOrders.length} missing orders...`);

        for (const order of missingOrders) {
            try {
                // Fetch customer
                const custRs = await db.execute({
                    sql: 'SELECT name, phone_number FROM customers WHERE id = ?',
                    args: [order.customer_id]
                });
                const cust = custRs.rows[0] || {};

                // Fetch services
                const servicesRs = await db.execute({
                    sql: 'SELECT * FROM services WHERE order_id = ?',
                    args: [order.order_id]
                });
                const services = servicesRs.rows;
                const servicesStr = services.map(s => `${s.service_type} x${s.quantity} (₹${s.price})`).join(', ');

                // Fetch measurements
                const measRs = await db.execute({
                    sql: 'SELECT * FROM measurements WHERE customer_id = ?',
                    args: [order.customer_id]
                });
                const m = measRs.rows[0] || {};

                const row = [
                    `#${String(order.order_id).padStart(4, '0')}`,
                    cust.name || '',
                    cust.phone_number || '',
                    order.booking_date || '',
                    order.delivery_date || '',
                    servicesStr,
                    order.total_amount || 0,
                    order.advance_paid || 0,
                    order.balance_amount || 0,
                    order.payment_method || 'Cash',
                    order.assigned_worker || '',
                    order.measurement_type || '',
                    m.length || m.m_length || '',
                    m.shoulder || '',
                    m.chest || '',
                    m.waist || '',
                    m.dot || '',
                    m.back_neck || '',
                    m.front_neck || '',
                    m.sleeves_length || '',
                    m.armhole || '',
                    m.chest_distance || '',
                    m.sleeves_round || '',
                    m.t_length || '',
                    m.t_shoulder || '',
                    m.t_chest || '',
                    m.t_waist || '',
                    m.t_back_neck || '',
                    m.t_front_neck || '',
                    m.t_sleeves_length || '',
                    m.t_sleeves_round || '',
                    m.t_half_body || '',
                    m.t_hip || '',
                    m.b_length || '',
                    m.b_bottom_round || '',
                    m.b_hip || '',
                    m.b_fly || '',
                    m.b_thai || '',
                    m.b_knee || '',
                    order.notes || '',
                    order.created_at || ''
                ];

                await sheets.spreadsheets.values.append({
                    spreadsheetId: SHEET_ID,
                    range: `${SHEET_TAB}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: { values: [row] },
                });

                console.log(`✅ Synced Order ${row[0]}`);
            } catch (err) {
                console.error(`❌ Failed to sync Order #${order.order_id}:`, err.message);
            }
        }

        console.log('🎉 Sync complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Sync script failed:', err.message);
        process.exit(1);
    }
}

sync();
