const { db } = require('./db');
const fs = require('fs');
const path = require('path');

async function exportToCSV() {
    try {
        console.log('⏳ Fetching data from Cloud DB...');
        
        // 1. Get all orders with customer info
        const ordersQuery = `
            SELECT 
                o.order_id, 
                c.name as customer_name, 
                c.phone_number, 
                o.booking_date, 
                o.delivery_date, 
                o.total_amount, 
                o.advance_paid, 
                o.balance_amount, 
                o.status,
                m.length, m.shoulder, m.chest, m.waist, m.dot, 
                m.back_neck, m.front_neck, m.sleeves_length, 
                m.armhole, m.chest_distance, m.sleeves_round
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            LEFT JOIN measurements m ON c.id = m.customer_id
            ORDER BY o.order_id DESC
        `;
        
        const result = await db.execute(ordersQuery);
        const rows = result.rows;

        if (rows.length === 0) {
            console.log('ℹ️ No orders found to export.');
            process.exit(0);
        }

        console.log(`📦 Found ${rows.length} orders. Formatting CSV...`);

        // 2. Define headers
        const headers = [
            'Order ID', 'Customer Name', 'Phone', 'Booking Date', 'Delivery Date',
            'Total Amount', 'Advance Paid', 'Balance', 'Status',
            'Length', 'Shoulder', 'Chest', 'Waist', 'Dot', 
            'Back Neck', 'Front Neck', 'Sleeves Length', 
            'Armhole', 'Chest Distance', 'Sleeves Round'
        ];

        // 3. Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        rows.forEach(row => {
            const csvRow = headers.map(header => {
                let key = header.toLowerCase().replace(/ /g, '_');
                // Map header to db column names where they differ
                const mapping = {
                    'order_id': 'order_id',
                    'customer_name': 'customer_name',
                    'phone': 'phone_number'
                };
                
                let val = row[mapping[key] || key];
                
                // Handle special cases or nulls
                if (val === null || val === undefined) val = '-';
                if (typeof val === 'string' && val.includes(',')) val = `"${val}"`;
                
                return val;
            });
            csvContent += csvRow.join(',') + '\n';
        });

        const outputPath = path.join(__dirname, 'cloud_backup.csv');
        fs.writeFileSync(outputPath, csvContent);

        console.log(`✅ Backup saved to: ${outputPath}`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Export failed:', err);
        process.exit(1);
    }
}

exportToCSV();
