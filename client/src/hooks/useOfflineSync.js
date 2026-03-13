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
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

        // 2. Create order
        const finalOrderPayload = { ...orderPayload, customer_id: cid };
        const orderRes = await api.post('/orders', finalOrderPayload);
        const createdOrderId = orderRes.data.order_id;

        // 3. Upload images
        if (images && images.length > 0) {
          await api.post(`/orders/${createdOrderId}/images`, { images });
        }

        // 4. Voice note
        if (audioData) {
          await api.post(`/orders/${createdOrderId}/voice-notes`, {
            audio_data: audioData,
            duration: recordingTime
          });
        }

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
