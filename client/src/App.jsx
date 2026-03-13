import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

  useEffect(() => {
    const handleOffline = () => {
      toast.error('You are offline. Changes will save locally and sync when reconnected.', { duration: 6000, id: 'net' });
    };
    const handleOnline = () => {
      toast.success('Back online! Syncing background changes...', { id: 'net' });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

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
