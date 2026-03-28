import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Toaster, toast } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import CustomerSearch from './pages/CustomerSearch';
import OrderHistory from './pages/OrderHistory';
import BillPreview from './pages/BillPreview';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import Profits from './pages/Profits';
import './index.css';
import { useRegisterSW } from 'virtual:pwa-register/react';
import useOfflineSync from './hooks/useOfflineSync';
import { WifiOff, RefreshCw } from 'lucide-react';

function OfflineBannerWrapper({ isOnline, isSyncing, syncOfflineOrders }) {
  const [show, setShow] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [location.pathname, isOnline]);

  if (!show || isOnline) return null;

  return (
    <div className="offline-banner">
      <WifiOff size={16} />
      <span>Offline</span>
      <button onClick={syncOfflineOrders} disabled={isSyncing} className="sync-btn">
        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>
    </div>
  );
}

export default function App() {
  const [sidebarOpen, useState_sidebarOpen] = useState(false);
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('tailor_auth');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const { isOnline, isSyncing, syncOfflineOrders } = useOfflineSync();

  if (!auth) {
    return (
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          <Route path="*" element={<Login setAuth={setAuth} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const isAdmin = auth.role === 'Admin';
  const toggleSidebar = () => useState_sidebarOpen(!sidebarOpen);
  const closeSidebar = () => useState_sidebarOpen(false);

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <OfflineBannerWrapper isOnline={isOnline} isSyncing={isSyncing} syncOfflineOrders={syncOfflineOrders} />
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} auth={auth} setAuth={setAuth} />

        {/* Mobile Overlay */}
        {sidebarOpen && <div className="mobile-overlay" onClick={closeSidebar}></div>}

        <main className="main-content">
          <Routes>
            <Route path="/" element={isAdmin ? <Dashboard onMenuClick={toggleSidebar} /> : <WorkerDashboard onMenuClick={toggleSidebar} auth={auth} />} />
            <Route path="/new-order" element={<NewOrder onMenuClick={toggleSidebar} auth={auth} />} />

            {isAdmin && (
              <>
                <Route path="/search" element={<CustomerSearch onMenuClick={toggleSidebar} />} />
                <Route path="/customer/:id" element={<CustomerSearch onMenuClick={toggleSidebar} />} />
                <Route path="/orders" element={<OrderHistory onMenuClick={toggleSidebar} />} />
                <Route path="/bill/:orderId" element={<BillPreview onMenuClick={toggleSidebar} />} />
                <Route path="/analytics" element={<Analytics onMenuClick={toggleSidebar} />} />
                <Route path="/profits" element={<Profits onMenuClick={toggleSidebar} />} />
              </>
            )}

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
