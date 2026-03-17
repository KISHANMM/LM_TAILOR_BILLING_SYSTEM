const { db } = require('./db');

async function migrate() {
  try {
    console.log('⏳ Adding UNIQUE constraint to measurements(customer_id)...');
    
    // SQLite/LibSQL doesn't support ALTER TABLE ADD CONSTRAINT easily for existing columns.
    // The safest way is to create a unique index.
    await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_customer_id ON measurements(customer_id)');
    
    console.log('✅ Unique index added successfully.');
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      console.error('❌ Could not add unique index: Duplicate records still exist. Please run cleanup script first.');
    } else {
      console.error('❌ Migration error:', err);
    }
  }
}

migrate();
