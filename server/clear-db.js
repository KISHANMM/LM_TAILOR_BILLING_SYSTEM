const { db } = require('./db');

async function clearDatabase() {
  try {
    console.log('⏳ Clearing all data from local database...');
    
    const tables = [
      'order_voice_notes',
      'order_images',
      'services',
      'orders',
      'measurements',
      'customers',
      'expenses'
    ];

    for (const table of tables) {
      console.log(`Clearing table: ${table}`);
      await db.execute(`DELETE FROM ${table}`);
      
      // Reset autoincrement sequences
      try {
        await db.execute(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
      } catch (e) {
        // sqlite_sequence might not exist or table might not have autoincrement
      }
    }

    console.log('✅ All data cleared successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error clearing database:', err);
    process.exit(1);
  }
}

clearDatabase();
