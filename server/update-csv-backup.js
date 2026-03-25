const fs = require('fs');
const path = require('path');

// We use the JSON backup we just created to ensure we are using the validated cloud data
const BACKUP_JSON = path.join(__dirname, 'turso_full_backup_2026-03-25.json');
const TARGET_CSV = path.join(__dirname, 'cloud_backup.csv');

function updateCsv() {
    console.log(`📂 Reading data from ${BACKUP_JSON}...`);
    
    if (!fs.existsSync(BACKUP_JSON)) {
        console.error('❌ Backup JSON file not found. Please run backup-turso.js first.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf8'));
    const { orders, customers, measurements } = data.tables;

    // Create maps for quick lookup
    const customerMap = {};
    customers.forEach(c => { customerMap[c.id] = c; });

    const measurementMap = {};
    measurements.forEach(m => { measurementMap[m.customer_id] = m; });

    const headers = [
        'Order ID', 'Customer Name', 'Phone', 'Booking Date', 'Delivery Date', 'Services',
        'Total Amount', 'Advance Paid', 'Balance', 'Payment Method', 'Worker', 'Meas. Type',
        'Length', 'Shoulder', 'Chest', 'Waist', 'Dot', 'Back Neck', 'Front Neck', 'Sleeves Length', 'Armhole', 'Chest Distance', 'Sleeves Round',
        'T-Length', 'T-Shoulder', 'T-Chest', 'T-Waist', 'T-Back_Neck', 'T-Front_Neck', 'T-Sleeves_Length', 'T-Sleeves_Round', 'T-Half_Body', 'T-Hip',
        'B-Length', 'B-Bottom_Round', 'B-Hip', 'B-Fly', 'B-Thai', 'B-Knee', 'Notes', 'Created At'
    ];

    const rows = [headers.join(',')];

    // Sort orders by ID descending
    const sortedOrders = [...orders].sort((a, b) => b.order_id - a.order_id);

    sortedOrders.forEach(o => {
        const cust = customerMap[o.customer_id] || {};
        const meas = measurementMap[o.customer_id] || {};
        const svcs = data.tables.services.filter(s => s.order_id === o.order_id);
        const servicesStr = `"${svcs.map(s => `${s.service_type} x${s.quantity}`).join(', ')}"`;

        const row = [
            `#${String(o.order_id).padStart(4, '0')}`,
            `"${cust.name || ''}"`,
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
            meas.length || meas.m_length || '-',
            meas.shoulder || '-',
            meas.chest || '-',
            meas.waist || '-',
            meas.dot || '-',
            meas.back_neck || '-',
            meas.front_neck || '-',
            meas.sleeves_length || '-',
            meas.armhole || '-',
            meas.chest_distance || '-',
            meas.sleeves_round || '-',
            meas.t_length || '-',
            meas.t_shoulder || '-',
            meas.t_chest || '-',
            meas.t_waist || '-',
            meas.t_back_neck || '-',
            meas.t_front_neck || '-',
            meas.t_sleeves_length || '-',
            meas.t_sleeves_round || '-',
            meas.t_half_body || '-',
            meas.t_hip || '-',
            meas.b_length || '-',
            meas.b_bottom_round || '-',
            meas.b_hip || '-',
            meas.b_fly || '-',
            meas.b_thai || '-',
            meas.b_knee || '-',
            `"${(o.notes || '').replace(/\n/g, ' ')}"`,
            o.created_at || ''
        ];
        rows.push(row.join(','));
    });

    fs.writeFileSync(TARGET_CSV, rows.join('\n'));
    console.log(`✅ Successfully updated ${TARGET_CSV} with ${sortedOrders.length} records.`);
}

updateCsv();
