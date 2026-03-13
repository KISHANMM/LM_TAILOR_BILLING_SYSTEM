import React, { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Package, Clock, CheckCircle, Menu, Eye, Plus, ChevronDown, ChevronUp, Ruler } from 'lucide-react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';

const MEASUREMENT_FIELDS = [
    { key: 'm_length', label: 'Length' },
    { key: 'shoulder', label: 'Shoulder' },
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'dot', label: 'Dot' },
    { key: 'back_neck', label: 'Back Neck' },
    { key: 'front_neck', label: 'Front Neck' },
    { key: 'sleeves_length', label: 'Sleeves Length' },
    { key: 'armhole', label: 'Armhole' },
    { key: 'chest_distance', label: 'Chest Distance' },
    { key: 'sleeves_round', label: 'Sleeves Round' },
];

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
    const [updatingId, setUpdatingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        if (auth?.name) fetchOrders();
    }, [auth.name]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/orders?worker=${auth.name}`);
            setOrders(response.data);
        } catch (error) {
            console.error('Error fetching worker orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (e, orderId, newStatus) => {
        e.stopPropagation(); // Prevent accordion from toggling
        if (updatingId) return;

        try {
            setUpdatingId(orderId);
            await api.put(`/orders/${orderId}`, { status: newStatus });
            toast.success(`Order marked as ${newStatus}`);
            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        } finally {
            setUpdatingId(null);
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
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th><th>Customer</th><th>Booking</th><th>Delivery</th><th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>
                                            No assigned orders
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map(o => (
                                        <Fragment key={o.order_id}>
                                            <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === o.order_id ? null : o.order_id)}>
                                                <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span></td>
                                                <td><strong>{o.customer_name}</strong></td>
                                                <td style={{ fontSize: 13 }}>{formatDate(o.booking_date)}</td>
                                                <td style={{ fontSize: 13 }}>{formatDate(o.delivery_date)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <StatusBadge status={o.status} />
                                                        {expandedId === o.order_id ? <ChevronUp size={16} color="var(--gray)" /> : <ChevronDown size={16} color="var(--gray)" />}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        {o.status === 'Pending' && (
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                style={{ borderColor: 'var(--green)', color: 'var(--green)', fontSize: 11, padding: '4px 8px' }}
                                                                onClick={(e) => handleStatusUpdate(e, o.order_id, 'Ready')}
                                                                disabled={updatingId === o.order_id}
                                                            >
                                                                Mark Ready
                                                            </button>
                                                        )}
                                                        {o.status === 'Ready' && (
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                style={{ borderColor: 'var(--maroon)', color: 'var(--maroon)', fontSize: 11, padding: '4px 8px' }}
                                                                onClick={(e) => handleStatusUpdate(e, o.order_id, 'Delivered')}
                                                                disabled={updatingId === o.order_id}
                                                            >
                                                                Deliver Order
                                                            </button>
                                                        )}
                                                        {o.status === 'Delivered' && (
                                                            <span style={{ fontSize: 11, color: 'var(--gray)' }}>Done</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedId === o.order_id && (
                                                <tr>
                                                    <td colSpan={6} style={{ background: 'var(--ivory)', padding: '16px 24px', borderBottom: '2px solid var(--maroon)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Ruler size={16} color="var(--gold)" />
                                                                <h4 style={{ margin: 0, fontSize: 14, color: 'var(--maroon)' }}>Customer Measurements</h4>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                {o.status === 'Pending' && (
                                                                    <button className="btn btn-sm btn-outline" style={{ borderColor: 'var(--green)', color: 'var(--green)' }} onClick={(e) => handleStatusUpdate(e, o.order_id, 'Ready')} disabled={updatingId === o.order_id}>Mark as Ready</button>
                                                                )}
                                                                {o.status === 'Ready' && (
                                                                    <button className="btn btn-sm" style={{ backgroundColor: 'var(--maroon)', color: 'white' }} onClick={(e) => handleStatusUpdate(e, o.order_id, 'Delivered')} disabled={updatingId === o.order_id}>Deliver Now</button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px 16px' }}>
                                                            {MEASUREMENT_FIELDS.map(m => o[m.key] ? (
                                                                <div key={m.key} style={{ fontSize: 13 }}>
                                                                    <span style={{ color: 'var(--gray)' }}>{m.label}:</span> <strong style={{ marginLeft: 4 }}>{o[m.key]}"</strong>
                                                                </div>
                                                            ) : null)}
                                                            {!MEASUREMENT_FIELDS.some(m => o[m.key]) && (
                                                                <div style={{ fontSize: 13, color: 'var(--gray)', fontStyle: 'italic' }}>No measurements provided or using sample piece.</div>
                                                            )}
                                                        </div>
                                                        {o.notes && (
                                                            <div style={{ marginTop: 16, padding: 12, background: '#fff', border: '1px solid var(--gray-light)', borderRadius: 6, fontSize: 13 }}>
                                                                <strong style={{ color: 'var(--maroon)' }}>Notes:</strong> <span style={{ marginLeft: 4 }}>{o.notes}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
