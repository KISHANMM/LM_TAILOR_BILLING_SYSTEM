const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

// If DATABASE_URL starts with 'libsql://', it's Cloud (Turso)
// If it's empty, we use a local file
// For local development, use a simple file name
// For cloud, use the full libsql:// URL
const url = process.env.DATABASE_URL || "file:./lm_tailor.db";
const isLocal = url.startsWith('file:');

console.log('🔗 Connecting to:', url);

const db = createClient({
  url: url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function initDB() {
  try {
    console.log('⏳ Running DB migration batch...');
    await db.batch([
      `CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        meas_length REAL,
        shoulder REAL,
        chest REAL,
        waist REAL,
        dot REAL,
        back_neck REAL,
        front_neck REAL,
        sleeves_length REAL,
        armhole REAL,
        chest_distance REAL,
        sleeves_round REAL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        booking_date TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        advance_paid REAL NOT NULL DEFAULT 0,
        balance_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending', 'Ready', 'Delivered')),
        measurement_type TEXT NOT NULL DEFAULT 'Body',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS services (
        service_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        service_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS order_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        image_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS order_voice_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        audio_data TEXT NOT NULL,
        duration INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS alterations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_alterations INTEGER NOT NULL DEFAULT 1,
        amount_received REAL NOT NULL DEFAULT 0,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`,
      `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
      `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_services_order_id ON services(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_services_service_type ON services(service_type)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`,
      `CREATE INDEX IF NOT EXISTS idx_alterations_date ON alterations(date)`
    ], "write");
    console.log('✅ Batch execution successful');

    // Rename/Add length column properly
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN meas_length REAL');
      console.log('✅ Added meas_length column to measurements table');
    } catch (e) { }

    // Add measurement_type to existing orders table if it doesn't exist
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN measurement_type TEXT NOT NULL DEFAULT "Body"');
      console.log('✅ Added measurement_type column to orders table');
    } catch (e) {
      // Ignored if column already exists
      if (!e.message.includes('duplicate column')) {
        // some other error
      }
    }

    // Add basic measurement fields if they don't exist
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN meas_length REAL');
      console.log('✅ Added meas_length column to measurements table');
    } catch (e) { }

    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN chest_distance REAL');
      console.log('✅ Added chest_distance column to measurements table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE measurements ADD COLUMN sleeves_round REAL');
      console.log('✅ Added sleeves_round column to measurements table');
    } catch (e) { }

    // Add assigned_worker and stitching_expense to orders table
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN assigned_worker TEXT');
      console.log('✅ Added assigned_worker column to orders table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN stitching_expense REAL NOT NULL DEFAULT 0');
      console.log('✅ Added stitching_expense column to orders table');
    } catch (e) { }
    try {
      await db.execute('ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT "Cash"');
      console.log('✅ Added payment_method column to orders table');
    } catch (e) { }
    
    // TOP Measurements
    const topFields = ['t_length', 't_shoulder', 't_chest', 't_waist', 't_back_neck', 't_front_neck', 't_sleeves_length', 't_sleeves_round', 't_half_body', 't_hip'];
    for (const f of topFields) {
      try { await db.execute(`ALTER TABLE measurements ADD COLUMN ${f} REAL`); console.log(`✅ Added ${f} to measurements`); } catch (e) { }
    }

    // BOTTOM Measurements
    const bottomFields = ['b_length', 'b_bottom_round', 'b_hip', 'b_fly', 'b_thai', 'b_knee'];
    for (const f of bottomFields) {
      try { await db.execute(`ALTER TABLE measurements ADD COLUMN ${f} REAL`); console.log(`✅ Added ${f} to measurements`); } catch (e) { }
    }

    // Ensure measurements has a unique constraint on customer_id (required for ON CONFLICT upsert)
    try {
      // Remove duplicate measurement rows — keep only the most recent one per customer
      await db.execute(`
        DELETE FROM measurements
        WHERE id NOT IN (
          SELECT MAX(id) FROM measurements GROUP BY customer_id
        )
      `);
      console.log('✅ Cleaned duplicate measurement rows');
    } catch (e) { console.log('ℹ️ Measurement dedup skipped:', e.message); }

    try {
      await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_customer_id ON measurements(customer_id)');
      console.log('✅ Unique index on measurements(customer_id) ensured');
    } catch (e) { console.log('ℹ️ Measurement unique index skipped:', e.message); }

    console.log('✅ Database Initialized (' + (isLocal ? 'Local' : 'Cloud') + ')');
  } catch (err) {
    console.error('❌ Database Initialization Error Details:', err);
  }
}

module.exports = { db, initDB, isLocal };
