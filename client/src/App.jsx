import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import CustomerSearch from './pages/CustomerSearch';
import OrderHistory from './pages/OrderHistory';
import BillPreview from './pages/BillPreview';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import WorkerDashboard from './pages/WorkerDashboard';
import Profits from './pages/Profits';
import Alterations from './pages/Alterations';
import EditOrder from './pages/EditOrder';
import './index.css';
import { useRegisterSW } from 'virtual:pwa-register/react';
import useOfflineSync from './hooks/useOfflineSync';
import { clearAllOfflineCaches } from './utils/offlineStore';
import { WifiOff, RefreshCw } from 'lucide-react';

function OfflineBannerWrapper({ isOnline, isSyncing, syncOfflineOrders }) {
  const [show, setShow] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!isOnline) {
      const showTimer = setTimeout(() => setShow(true), 0);
      const hideTimer = setTimeout(() => setShow(false), 2000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    } else {
      const hideTimer = setTimeout(() => setShow(false), 0);
      return () => clearTimeout(hideTimer);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('tailor_auth');
    const token = localStorage.getItem('tailor_token');
    if (!saved || !token) return null;
    try { return JSON.parse(saved); } catch { return null; }
  });

  useEffect(() => {
    if (!auth) {
      clearAllOfflineCaches();
    }
  }, [auth]);

  const {
    needRefresh: [_needRefresh, _setNeedRefresh],
    updateServiceWorker: _updateServiceWorker,
  } = useRegisterSW();

  const { isOnline, isSyncing, syncOfflineOrders } = useOfflineSync();

  if (!auth) {
    return (
      <BrowserRouter>
        <Toaster position={window.innerWidth <= 768 ? "bottom-center" : "top-right"} toastOptions={{ duration: 2000 }} />
        <Routes>
          <Route path="*" element={<Login setAuth={setAuth} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const isAdmin = auth.role === 'Admin';
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <BrowserRouter>
      <Toaster position={window.innerWidth <= 768 ? "bottom-center" : "top-right"} toastOptions={{ duration: 2000 }} />
      <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <OfflineBannerWrapper isOnline={isOnline} isSyncing={isSyncing} syncOfflineOrders={syncOfflineOrders} />
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} auth={auth} setAuth={setAuth} />

        {/* Mobile Overlay */}
        {sidebarOpen && <div className="mobile-overlay" onClick={closeSidebar}></div>}

        <main className="main-content">
          <Routes>
            <Route path="/" element={isAdmin ? <Dashboard onMenuClick={toggleSidebar} /> : <WorkerDashboard onMenuClick={toggleSidebar} auth={auth} setAuth={setAuth} />} />
            <Route path="/new-order" element={<NewOrder onMenuClick={toggleSidebar} auth={auth} />} />
            <Route path="/customer/:id" element={<CustomerSearch onMenuClick={toggleSidebar} auth={auth} />} />

            {isAdmin && (
              <>
                  <Route path="/search" element={<CustomerSearch onMenuClick={toggleSidebar} auth={auth} />} />
                  <Route path="/orders" element={<OrderHistory onMenuClick={toggleSidebar} />} />
                  <Route path="/bill/:orderId" element={<BillPreview onMenuClick={toggleSidebar} />} />
                  <Route path="/edit-order/:orderId" element={<EditOrder onMenuClick={toggleSidebar} />} />
                  <Route path="/analytics" element={<Analytics onMenuClick={toggleSidebar} />} />
                  <Route path="/profits" element={<Profits onMenuClick={toggleSidebar} />} />
                  <Route path="/alterations" element={<Alterations onMenuClick={toggleSidebar} />} />
              </>
            )}

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
