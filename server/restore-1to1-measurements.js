const { db } = require('./db');

async function restore1to1() {
  try {
    console.log('⏳ Identifying duplicate measurements...');
    const duplicatesRs = await db.execute(`
      SELECT customer_id, COUNT(*) as count 
      FROM measurements 
      GROUP BY customer_id 
      HAVING count > 1
    `);

    const duplicates = duplicatesRs.rows;
    console.log(`Found ${duplicates.length} customers with duplicate measurements.`);

    for (const row of duplicates) {
      const customerId = row.customer_id;
      console.log(`Processing customer ID: ${customerId}`);

      // Get all measurements for this customer, ordered by updated_at or id descending
      const measurementsRs = await db.execute({
        sql: 'SELECT id FROM measurements WHERE customer_id = ? ORDER BY updated_at DESC, id DESC',
        args: [customerId]
      });

      const ids = measurementsRs.rows.map(m => m.id);
      const keepId = ids[0];
      const deleteIds = ids.slice(1);

      console.log(`Keeping measurement ID ${keepId}, deleting IDs: ${deleteIds.join(', ')}`);

      if (deleteIds.length > 0) {
        await db.execute({
          sql: `DELETE FROM measurements WHERE id IN (${deleteIds.join(',')})`,
          args: []
        });
      }
    }

    console.log('✅ Database cleanup completed successfully.');
  } catch (err) {
    console.error('❌ Error during cleanup:', err);
  }
}

restore1to1();
