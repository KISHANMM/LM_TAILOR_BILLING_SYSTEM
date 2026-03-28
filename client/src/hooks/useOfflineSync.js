import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { getOfflineOrders, removeOfflineOrder } from '../utils/offlineStore';

export default function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineOrders();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    if (navigator.onLine) {
      syncOfflineOrders();
      syncCustomersForOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function syncCustomersForOffline() {
    try {
      const res = await api.get('/customers');
      if (res.data && res.data.length > 0) {
        import('../utils/offlineStore').then(({ saveAllCustomersToOffline }) => {
          saveAllCustomersToOffline(res.data);
        });
      }
    } catch (err) {
      console.error('Failed to sync customers for offline use:', err);
    }
  }

  async function syncOfflineOrders() {
    const orders = await getOfflineOrders();
    if (orders.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;

    for (const order of orders) {
      try {
        // Prepare payload (match NewOrder.jsx submit logic)
        const { customer, measPayload, orderPayload, images, audioData, recordingTime } = order;

        // 1. Create/lookup customer
        const custRes = await api.post('/customers', {
          name: customer.name,
          phone_number: customer.phone_number,
          measurements: measPayload,
        });
        const cid = custRes.data.id;

        // 2. Create order (sending images and audio locally, so the backend duplicate guard prevents duplicate uploads)
        const finalOrderPayload = { 
          ...orderPayload, 
          customer_id: cid,
          images: images && images.length > 0 ? images : undefined,
          audio_data: audioData || undefined,
          recordingTime: recordingTime || undefined
        };
        const orderRes = await api.post('/orders', finalOrderPayload);

        // Delete from local queue after successful sync
        await removeOfflineOrder(order.id);
        successCount++;
      } catch (err) {
        console.error('Failed to sync offline order:', order.id, err);
      }
    }

    if (successCount > 0) {
      toast.success(`Synced ${successCount} offline order(s) successfully!`);
    }
    setIsSyncing(false);
  }

  return { isOnline, isSyncing, syncOfflineOrders };
}
