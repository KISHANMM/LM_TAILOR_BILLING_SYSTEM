const { db } = require('./db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fullBackup() {
    console.log('🔗 Starting Full Cloud Backup from Turso...');
    
    // Check if we are actually pointing to Cloud
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
        console.warn('⚠️  WARNING: DATABASE_URL is pointing to a LOCAL file. If you want to backup Cloud data, please update your .env first.');
    }

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupFile = path.join(__dirname, `turso_full_backup_${timestamp}.json`);
        
        const backupData = {
            timestamp: new Date().toISOString(),
            database: process.env.DATABASE_URL,
            tables: {}
        };

        const tables = [
            'customers',
            'measurements',
            'orders',
            'services',
            'order_images',
            'expenses',
            'order_voice_notes'
        ];

        for (const table of tables) {
            console.log(`📦 Fetching data from [${table}]...`);
            try {
                const rs = await db.execute(`SELECT * FROM ${table}`);
                backupData.tables[table] = rs.rows;
                console.log(`✅ Fetched ${rs.rows.length} rows from ${table}`);
            } catch (err) {
                console.error(`❌ Failed to fetch table [${table}]:`, err.message);
            }
        }

        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        console.log('\n--- Backup Complete! ---');
        console.log(`📄 File saved: ${backupFile}`);
        console.log(`📊 Backup includes: ${Object.keys(backupData.tables).length} tables`);
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Backup script failed:', err.message);
        process.exit(1);
    }
}

fullBackup();
