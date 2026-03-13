import { openDB } from 'idb';

const DB_NAME = 'tailor-offline-db';
const STORE_NAME = 'orders-queue';

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveOfflineOrder(orderData) {
  const db = await initDB();
  return db.add(STORE_NAME, {
    ...orderData,
    timestamp: Date.now()
  });
}

export async function getOfflineOrders() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function removeOfflineOrder(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}

export async function clearOfflineOrders() {
  const db = await initDB();
  return db.clear(STORE_NAME);
}
