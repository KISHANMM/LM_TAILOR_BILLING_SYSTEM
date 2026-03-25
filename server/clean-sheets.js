const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = 'Orders';
const BACKUP_JSON = path.join(__dirname, 'turso_full_backup_2026-03-25.json');

async function cleanSheet() {
    if (!SHEET_ID) {
        console.error('❌ GOOGLE_SHEET_ID not set in .env');
        return;
    }

    if (!fs.existsSync(BACKUP_JSON)) {
        console.error('❌ Backup JSON file not found. Please run backup-turso.js first to ensure we have the production data.');
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

        console.log(`📂 Reading production data from [${BACKUP_JSON}]...`);
        const data = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf8'));
        const { orders, customers, measurements, services } = data.tables;

        // Preparation logic (same as sync script but for all 30 records)
        const customerMap = {}; customers.forEach(c => { customerMap[c.id] = c; });
        const measurementMap = {}; measurements.forEach(m => { measurementMap[m.customer_id] = m; });
        const serviceMap = {};
        services.forEach(s => {
            if (!serviceMap[s.order_id]) serviceMap[s.order_id] = [];
            serviceMap[s.order_id].push(s);
        });

        // Format ALL 30 records into rows
        const sortedOrders = [...orders].sort((a, b) => a.order_id - b.order_id);
        const newRows = sortedOrders.map(o => {
            const cust = customerMap[o.customer_id] || {};
            const meas = measurementMap[o.customer_id] || {};
            const svcs = serviceMap[o.order_id] || [];
            const servicesStr = svcs.map(s => `${s.service_type} x${s.quantity} (₹${s.price})`).join(', ');

            return [
                `#${String(o.order_id).padStart(4, '0')}`,
                cust.name || '',
                cust.phone_number || '',
                o.booking_date || '',
                o.delivery_date || '',
                servicesStr,
                o.total_amount || 0,
                o.advance_paid || 0,
                o.balance_amount || 0,
                o.payment_method || 'Cash',
                o.assigned_worker || '',
                o.measurement_type || '',
                meas.length || meas.m_length || '',
                meas.shoulder || '',
                meas.chest || '',
                meas.waist || '',
                meas.dot || '',
                meas.back_neck || '',
                meas.front_neck || '',
                meas.sleeves_length || '',
                meas.armhole || '',
                meas.chest_distance || '',
                meas.sleeves_round || '',
                meas.t_length || '',
                meas.t_shoulder || '',
                meas.t_chest || '',
                meas.t_waist || '',
                meas.t_back_neck || '',
                meas.t_front_neck || '',
                meas.t_sleeves_length || '',
                meas.t_sleeves_round || '',
                meas.t_half_body || '',
                meas.t_hip || '',
                meas.b_length || '',
                meas.b_bottom_round || '',
                meas.b_hip || '',
                meas.b_fly || '',
                meas.b_thai || '',
                meas.b_knee || '',
                o.notes || '',
                o.created_at || ''
            ];
        });

        console.log(`\n🧹 Clearing existing data in Google Sheet [${SHEET_TAB}]...`);
        // We clear from A2 onwards to keep headers
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A2:AZ1000`,
        });

        console.log(`🚀 Writing ${newRows.length} sequential production records to Google Sheet...`);
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: newRows },
        });

        console.log('🎉 Cleanup complete! The Google Sheet is now clean and sequential.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
        process.exit(1);
    }
}

cleanSheet();
