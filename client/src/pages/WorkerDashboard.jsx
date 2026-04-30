import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle, Menu, Plus } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { getWorkerTasksOffline, saveWorkerTasksOffline } from '../utils/offlineStore';

function StatusBadge({ status }) {
    const cls = {
        Pending: 'badge badge-pending',
        Ready: 'badge badge-ready',
        Delivered: 'badge badge-delivered',
    }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WorkerDashboard({ onMenuClick, auth }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (auth?.name) fetchOrders();
    }, [auth.name]);

    const processAndSetOrders = (data) => {
        const activeOrders = data
            .filter(o => o.status !== 'Delivered')
            .sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
        setOrders(activeOrders);
    };

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const offlineTasks = await getWorkerTasksOffline();
            if (offlineTasks && offlineTasks.length > 0) {
                processAndSetOrders(offlineTasks);
                setLoading(false);
            }

            if (navigator.onLine) {
                const response = await api.get(`/orders?worker=${auth.name}`);
                processAndSetOrders(response.data);
                await saveWorkerTasksOffline(response.data);
            } else if (!offlineTasks || offlineTasks.length === 0) {
                toast.error('You are offline and have no cached tasks.');
            }
        } catch (error) {
            console.error('Error fetching worker orders:', error);
            if (navigator.onLine) toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Worker Dashboard</div>
                        <div className="topbar-subtitle">Loading tasks...</div>
                    </div>
                </div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    const pendingCount = orders.filter(o => o.status === 'Pending').length;
    const readyCount = orders.filter(o => o.status === 'Ready').length;

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Hello, {auth.name}</div>
                        <div className="topbar-subtitle">Here are your assigned tasks</div>
                    </div>
                </div>
                <Link to="/new-order" className="btn btn-primary">
                    <Plus size={16} /> <span className="hide-mobile">New Order</span>
                </Link>
            </div>

            <div className="page-container">
                <div className="grid-2 mb-24">
                    <div className="stat-card maroon">
                        <div className="stat-icon" style={{ background: 'rgba(106,30,46,0.1)' }}>
                            <Package size={20} color="#6A1E2E" />
                        </div>
                        <div className="stat-value">{pendingCount}</div>
                        <div className="stat-label">Pending Assigned Orders</div>
                    </div>
                    <div className="stat-card green">
                        <div className="stat-icon" style={{ background: 'rgba(46,125,50,0.1)' }}>
                            <CheckCircle size={20} color="#2E7D32" />
                        </div>
                        <div className="stat-value">{readyCount}</div>
                        <div className="stat-label">Ready for Pickup</div>
                    </div>
                </div>

                <div className="card mt-24">
                    <div className="card-header">
                        <h3 className="card-title flex gap-8"><Clock size={18} color="var(--gold)" /> Your Assigned Orders</h3>
                    </div>
                    <div className="card-body" style={{ padding: 16 }}>
                        {orders.length === 0 ? (
                            <div className="empty-state">
                                No assigned orders
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                {orders.map(o => (
                                    <div 
                                        key={o.order_id} 
                                        onClick={() => navigate(`/customer/${o.customer_id}`, { state: { offlineData: o } })}
                                        style={{ 
                                            cursor: 'pointer', 
                                            background: '#fff', 
                                            border: '1px solid var(--gray-light)', 
                                            borderRadius: 12, 
                                            padding: 16, 
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', 
                                            position: 'relative',
                                            transition: 'all 0.2s ease-in-out'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'var(--gray-light)'; }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <div>
                                                <div style={{ fontSize: 13, color: 'var(--gray)', fontWeight: 500, marginBottom: 4 }}>Order #{String(o.order_id).padStart(4, '0')}</div>
                                                <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', color: 'var(--maroon-dark)', fontWeight: 600 }}>{o.customer_name}</div>
                                            </div>
                                            <StatusBadge status={o.status} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--ivory)', padding: 12, borderRadius: 8, border: '1px solid var(--gold-pale)' }}>
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Booking Date</div>
                                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--maroon)' }}>{formatDate(o.booking_date)}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 11, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Delivery By</div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#E65100' }}>{formatDate(o.delivery_date)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
