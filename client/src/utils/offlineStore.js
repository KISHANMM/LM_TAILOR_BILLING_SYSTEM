import { openDB } from 'idb';

const DB_NAME = 'tailor-offline-db';
const ORDERS_STORE = 'orders-queue';
const CUSTOMERS_STORE = 'customers-cache';

export async function initDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
        const custStore = db.createObjectStore(CUSTOMERS_STORE, { keyPath: 'id' });
        custStore.createIndex('phone', 'phone_number', { unique: false });
        custStore.createIndex('name', 'name', { unique: false });
      }
    },
  });
}

// ---- ORDERS ----
export async function saveOfflineOrder(orderData) {
  const db = await initDB();

  let resolvedCustomerId = orderData.customer_id || null;

  // If it's a brand-new offline customer, generate & save them first so we have their ID
  if (orderData.customer && !orderData.customer_id) {
    resolvedCustomerId = `temp-${Date.now()}`;
    await db.put(CUSTOMERS_STORE, {
      id: resolvedCustomerId,
      name: orderData.customer.name,
      phone_number: orderData.customer.phone_number,
      created_at: null,
      ...orderData.measPayload
    });
  }

  const insertId = await db.add(ORDERS_STORE, {
    ...orderData,
    customer_id: resolvedCustomerId,  // Bind the final resolved customer ID to the order
    timestamp: Date.now()
  });

  return insertId;
}

export async function getOfflineOrders() {
  const db = await initDB();
  return db.getAll(ORDERS_STORE);
}

export async function removeOfflineOrder(id) {
  const db = await initDB();
  return db.delete(ORDERS_STORE, id);
}

export async function clearOfflineOrders() {
  const db = await initDB();
  return db.clear(ORDERS_STORE);
}

// ---- CUSTOMERS ----
export async function saveAllCustomersToOffline(customers) {
  const db = await initDB();
  const tx = db.transaction(CUSTOMERS_STORE, 'readwrite');
  customers.forEach(c => tx.store.put(c));
  await tx.done;
}

export async function getOfflineCustomerById(id) {
  const db = await initDB();
  return db.get(CUSTOMERS_STORE, parseInt(id) || id);
}

export async function searchOfflineCustomers(query) {
  const db = await initDB();
  const allCustomers = await db.getAll(CUSTOMERS_STORE);
  const q = query.toLowerCase();
  
  if (/^\d+$/.test(q)) {
    return allCustomers.filter(c => c.phone_number?.includes(q));
  } else {
    return allCustomers.filter(c => c.name?.toLowerCase().includes(q));
  }
}
