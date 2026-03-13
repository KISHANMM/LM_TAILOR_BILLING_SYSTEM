const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

// If DATABASE_URL starts with 'libsql://', it's Cloud (Turso)
// If it's empty, we use a local file
// For local development, use a simple file name
// For cloud, use the full libsql:// URL
const isLocal = !process.env.DATABASE_URL;
const url = process.env.DATABASE_URL || "file:./lm_tailor.db";

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
        length REAL,
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
      )`
    ], "write");
    console.log('✅ Batch execution successful');

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

    // Add new measurement fields if they don't exist
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

    console.log('✅ Database Initialized (' + (isLocal ? 'Local' : 'Cloud') + ')');
  } catch (err) {
    console.error('❌ Database Initialization Error Details:', err);
  }
}

module.exports = { db, initDB };
