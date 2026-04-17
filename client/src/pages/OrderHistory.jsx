import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Eye, Filter, RefreshCw, Menu, LayoutGrid, List, Edit2, Check, X, User, Trash2, AlertTriangle } from 'lucide-react';
import api from '../api/axios';
import { getOfflineOrders } from '../utils/offlineStore';

function StatusBadge({ status }) {
    const cls = { Pending: 'badge badge-pending', Ready: 'badge badge-ready', Delivered: 'badge badge-delivered' }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = ['All', 'Pending', 'Ready', 'Delivered', 'Overdue'];

export default function OrderHistory({ onMenuClick }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const location = useLocation();
    const initStatus = new URLSearchParams(location.search).get('status') || 'All';
    const [statusFilter, setStatusFilter] = useState(STATUS_OPTIONS.includes(initStatus) ? initStatus : 'All');
    const [dateFilter, setDateFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');
    const [editingAdvanceId, setEditingAdvanceId] = useState(null);
    const [tempAdvanceValue, setTempAdvanceValue] = useState('');

    // Today's date string (YYYY-MM-DD) for overdue comparison
    const todayStr = new Date().toISOString().split('T')[0];

    function fetchOrders() {
        setLoading(true);
        const params = new URLSearchParams();
        // For Overdue, fetch all non-delivered orders then filter client-side
        const apiStatus = statusFilter === 'Overdue' ? null : statusFilter;
        if (apiStatus && apiStatus !== 'All') params.set('status', apiStatus);
        if (dateFilter) params.set('date', dateFilter);
        if (search) params.set('search', search);
        
        Promise.all([
            api.get(`/orders?${params}`).catch(() => ({ data: [] })), 
            getOfflineOrders().catch(() => [])
        ]).then(([apiRes, offlineOrders]) => {
            let combined = apiRes.data || [];

            if (offlineOrders && offlineOrders.length > 0) {
                let parsedOffline = offlineOrders.map(o => {
                    const p = o.orderPayload;
                    const total = p.services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
                    return {
                        order_id: `offline-${o.id}`,
                        customer_id: o.customer_id || `temp-${o.id}`,
                        customer_name: o.customer?.name || 'Unknown',
                        phone_number: o.customer?.phone_number || '',
                        delivery_date: p.delivery_date,
                        total_amount: total,
                        advance_paid: p.advance_paid,
                        balance_amount: total - parseFloat(p.advance_paid),
                        status: 'Pending',
                        isOfflineQueue: true
                    };
                });

                // Apply filters locally to offline items since API missed them
                if (search) {
                    const s = search.toLowerCase();
                    parsedOffline = parsedOffline.filter(o => 
                        o.customer_name?.toLowerCase().includes(s) || 
                        o.phone_number?.includes(s)
                    );
                }
                if (statusFilter !== 'All' && statusFilter !== 'Overdue') {
                    parsedOffline = parsedOffline.filter(o => o.status === statusFilter);
                }
                if (dateFilter) {
                    parsedOffline = parsedOffline.filter(o => o.delivery_date === dateFilter);
                }

                combined = [...parsedOffline, ...combined];
            }

            // Overdue: filter to only non-delivered orders with past delivery date
            if (statusFilter === 'Overdue') {
                combined = combined.filter(o =>
                    o.status !== 'Delivered' && o.delivery_date < todayStr
                );
                // Sort by most overdue first (oldest delivery date first)
                combined.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
            } else if (statusFilter === 'Pending' || statusFilter === 'Ready') {
                combined.sort((a, b) => new Date(a.delivery_date) - new Date(b.delivery_date));
            }
            setOrders(combined);
        })
        .finally(() => setLoading(false));
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, statusFilter, dateFilter]);

    async function handleStatusChange(orderId, newStatus) {
        // If marking as Delivered and balance is outstanding, ask about payment
        if (newStatus === 'Delivered') {
            const order = orders.find(o => o.order_id === orderId);
            const balance = order ? parseFloat(order.balance_amount) : 0;
            if (balance > 0) {
                const balanceCleared = window.confirm(
                    `Balance of ₹${balance.toLocaleString('en-IN')} is still pending. Has the customer cleared the full payment?`
                );
                
                // If they click cancel, abort the status change entirely
                if (!balanceCleared) {
                    return;
                }

                setUpdatingId(orderId);
                try {
                    await api.put(`/orders/${orderId}/status`, { status: newStatus });
                    await api.put(`/orders/${orderId}`, {
                        advance_paid: order.total_amount,
                        services: order.services
                    });
                    const updated = orders.map(o => {
                        if (o.order_id === orderId) {
                            return {
                                ...o,
                                status: newStatus,
                                advance_paid: order.total_amount,
                                balance_amount: 0
                            };
                        }
                        return o;
                    });
                    setOrders(updated);
                } catch (err) {
                    console.error('Status update failed:', err);
                } finally {
                    setUpdatingId(null);
                }
                return;
            }
        }

        setUpdatingId(orderId);
        try {
            await api.put(`/orders/${orderId}/status`, { status: newStatus });
            const updated = orders.map(o => {
                if (o.order_id === orderId) {
                    return { ...o, status: newStatus };
                }
                return o;
            });
            setOrders(updated);

            // Trigger WhatsApp if status becomes 'Ready'
            if (newStatus === 'Ready') {
                const targetOrder = updated.find(o => o.order_id === orderId);
                if (targetOrder) {
                    handleWhatsAppReady(targetOrder);
                }
            }
        } catch (err) {
            console.error('Status update failed:', err);
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleAdvanceUpdate(orderId) {
        const val = parseFloat(tempAdvanceValue) || 0;
        if (!window.confirm(`Are you sure you want to update the advance to \u20b9${val.toLocaleString('en-IN')}?`)) {
            return;
        }
        setUpdatingId(orderId);
        try {
            const r = await api.put(`/orders/${orderId}/advance`, { advance_paid: val });
            setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, advance_paid: val, balance_amount: r.data.balance_amount } : o));
            setEditingAdvanceId(null);
        } catch (err) {
            console.error(err);
            alert('Failed to update advance');
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleDelete(orderId) {
        if (!window.confirm("Are you sure you want to delete this order?")) return;
        
        const pwd = window.prompt("Enter the Password :");
        if (pwd !== "LataMagaji") {
            alert("Incorrect password. Deletion aborted.");
            return;
        }

        setUpdatingId(orderId);
        try {
            await api.delete(`/orders/${orderId}`);
            setOrders(prev => prev.filter(o => o.order_id !== orderId));
            alert("Order deleted successfully.");
        } catch (err) {
            console.error(err);
            alert("Failed to delete order.");
        } finally {
            setUpdatingId(null);
        }
    }

    const filtered = orders;

    const handleWhatsAppReady = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) {
            phoneForUrl = '91' + phoneForUrl;
        }

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Your blouse is ready to collect!\n\n` +
            `Order No: #${String(order.order_id).padStart(4, '0')}\n` +
            `Balance Amount: ₹${order.balance_amount.toLocaleString('en-IN')}\n\n` +
            `*( Reminder : Please Give us a Call Before Coming to Shop at +919916562127 )*\n\n` +
            `Please visit us soon. – L.M. Ladies Tailor`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    };

    const handleWhatsAppReview = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) {
            phoneForUrl = '91' + phoneForUrl;
        }

        const msg = encodeURIComponent(
            `Dear ${order.customer_name},\n\n` +
            `Thank you for choosing L.M. Ladies Tailor! We hope you are satisfied with our stitching.\n\n` +
            `We would love to hear your feedback. Your review helps us improve and also supports our small business.\n\n` +
            `If you have a moment, please leave us a review on Google:\n` +
            `https://g.co/kgs/LUPXvNh\n\n` +
            `Thank you for your support!\n` +
            `– L.M. Ladies Tailor`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    };

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Order History</div>
                        <div className="topbar-subtitle">{filtered.length} order(s) found</div>
                    </div>
                </div>
                <div className="flex gap-8" style={{ flexWrap: 'nowrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <div className="flex gap-2 p-2" style={{ background: 'var(--gray-light)', borderRadius: 6, flexShrink: 0 }}>
                        <button
                            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('table')}
                            style={{ padding: '4px 8px', minHeight: 'auto', border: 'none' }}
                            title="Table View"
                        >
                            <List size={14} />
                        </button>
                        <button
                            className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setViewMode('cards')}
                            style={{ padding: '4px 8px', minHeight: 'auto', border: 'none' }}
                            title="Card View"
                        >
                            <LayoutGrid size={14} />
                        </button>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={fetchOrders} style={{ flexShrink: 0, padding: '4px 8px' }}>
                        <RefreshCw size={14} /> <span className="hide-mobile" style={{ fontSize: '11px' }}>Refresh</span>
                    </button>
                </div>
            </div>

            <div className="page-container">
                {/* Filters */}
                <div className="card mb-24">
                    <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: '2 1 240px' }}>
                            <label className="form-label"><Search size={14} style={{ marginRight: 6 }} />Search Customer</label>
                            <input
                                className="form-input"
                                placeholder="Enter name or phone..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchOrders()}
                            />
                        </div>
                        <div style={{ flex: '1 1 150px' }}>
                            <label className="form-label"><Filter size={14} style={{ marginRight: 6 }} />Status</label>
                            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: '1 1 180px' }}>
                            <label className="form-label">Delivery Date</label>
                            <input
                                className="form-input"
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-8">
                            <button className="btn btn-primary" onClick={fetchOrders}>Apply Filters</button>
                            <button className="btn btn-ghost" onClick={() => { setSearch(''); setStatusFilter('All'); setDateFilter(''); }}>Reset</button>
                        </div>
                    </div>
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(s => {
                        const isOverdue = s === 'Overdue';
                        // Count overdue orders from current loaded data (only when not already on overdue tab)
                        const overdueCount = isOverdue
                            ? orders.filter(o => o.status !== 'Delivered' && o.delivery_date < todayStr).length
                            : 0;
                        return (
                            <button
                                key={s}
                                className={`btn btn-sm ${statusFilter === s
                                    ? isOverdue ? '' : 'btn-maroon'
                                    : 'btn-ghost'
                                }`}
                                onClick={() => setStatusFilter(s)}
                                style={isOverdue ? {
                                    background: statusFilter === s ? '#B71C1C' : '#FFF0F0',
                                    color: statusFilter === s ? '#fff' : '#B71C1C',
                                    border: '1.5px solid #ef9a9a',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5
                                } : {}}
                            >
                                {isOverdue && <AlertTriangle size={13} />}
                                {s}
                                {isOverdue && overdueCount > 0 && (
                                    <span style={{
                                        background: statusFilter === s ? 'rgba(255,255,255,0.3)' : '#B71C1C',
                                        color: '#fff',
                                        borderRadius: 10,
                                        padding: '1px 7px',
                                        fontSize: 11,
                                        fontWeight: 800,
                                        marginLeft: 2,
                                        lineHeight: 1.5
                                    }}>
                                        {overdueCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="card">
                    {loading ? (
                        <div className="card-body">
                            <div className="spinner" />
                        </div>
                    ) : (
                        <div className="card-body" style={{ padding: 0 }}>
                            {viewMode === 'table' && (
                                <div className="table-container" style={{ border: 'none' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Order ID</th>
                                                <th>Customer Name</th>
                                                <th className="hide-tablet">Phone Number</th>
                                                <th>Delivery Date</th>
                                                <th>Total</th>
                                                <th>Advance</th>
                                                <th>Balance</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0 && (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--gray)' }}>
                                                        No orders found
                                                    </td>
                                                </tr>
                                            )}
                                            {filtered.map(o => {
                                                const isOverdueRow = o.status !== 'Delivered' && o.delivery_date < todayStr;
                                                return (
                                                <tr key={o.order_id} style={isOverdueRow ? { background: 'rgba(183,28,28,0.04)' } : {}}>
                                                    <td>
                                                        {o.isOfflineQueue ? (
                                                            <span style={{ fontWeight: 700, color: '#E65100', fontSize: 13 }} title="Pending Sync">Pending Sync</span>
                                                        ) : (
                                                            <span style={{ fontWeight: 700, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                            <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                                                        </Link>
                                                    </td>
                                                    <td className="hide-tablet" style={{ fontSize: '13px' }}>{o.phone_number}</td>
                                                    <td style={{ color: new Date(o.delivery_date) < new Date() && o.status !== 'Delivered' ? '#E65100' : 'inherit', fontWeight: 500 }}>
                                                        {formatDate(o.delivery_date)}
                                                    </td>
                                                     <td><strong>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</strong></td>
                                                     <td>
                                                         {editingAdvanceId === o.order_id ? (
                                                             <div className="flex gap-2">
                                                                 <input
                                                                     type="number"
                                                                     className="form-input"
                                                                     style={{ width: 80, padding: '4px 8px', fontSize: '12px' }}
                                                                     value={tempAdvanceValue}
                                                                     onChange={e => setTempAdvanceValue(e.target.value)}
                                                                     onKeyDown={e => e.key === 'Enter' && handleAdvanceUpdate(o.order_id)}
                                                                     autoFocus
                                                                 />
                                                                 <button className="btn btn-sm btn-ghost p-0" onClick={() => handleAdvanceUpdate(o.order_id)}>
                                                                     <Check size={16} color="#2E7D32" />
                                                                 </button>
                                                                 <button className="btn btn-sm btn-ghost p-0" onClick={() => setEditingAdvanceId(null)}>
                                                                     <X size={16} color="#D32F2F" />
                                                                 </button>
                                                             </div>
                                                         ) : (
                                                             <div className="flex gap-2 items-center group">
                                                                 {`\u20b9${parseFloat(o.advance_paid).toLocaleString('en-IN')}`}
                                                                 {!o.isOfflineQueue && (
                                                                 <button
                                                                     className="btn btn-sm btn-ghost p-0 opacity-0 group-hover:opacity-100"
                                                                     onClick={() => { setEditingAdvanceId(o.order_id); setTempAdvanceValue(o.advance_paid); }}
                                                                 >
                                                                     <Edit2 size={12} />
                                                                 </button>
                                                                 )}
                                                             </div>
                                                         )}
                                                     </td>
                                                    <td style={{ color: parseFloat(o.balance_amount) > 0 ? '#E65100' : '#2E7D32', fontWeight: 600 }}>
                                                        {`\u20b9${parseFloat(o.balance_amount).toLocaleString('en-IN')}`}
                                                    </td>
                                                    <td>
                                                        <select
                                                            className="form-select"
                                                            style={{ padding: '4px 8px', fontSize: '13px', width: '120px' }}
                                                            value={o.status}
                                                            disabled={updatingId === o.order_id}
                                                            onChange={e => handleStatusChange(o.order_id, e.target.value)}
                                                        >
                                                            <option>Pending</option>
                                                            <option>Ready</option>
                                                            <option>Delivered</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-8">
                                                            <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                                <Eye size={14} /> Bill
                                                            </Link>
                                                            {!o.isOfflineQueue && o.status === 'Delivered' && (
                                                                <button
                                                                    className="btn btn-sm btn-maroon"
                                                                    title="Send Request Review"
                                                                    onClick={(e) => { e.stopPropagation(); handleWhatsAppReview(o); }}
                                                                >
                                                                    Review
                                                                </button>
                                                            )}
                                                            {!o.isOfflineQueue && (
                                                                <button 
                                                                    className="btn btn-sm btn-danger" 
                                                                    title="Delete Order"
                                                                    onClick={(e) => { e.stopPropagation(); handleDelete(o.order_id); }}
                                                                    disabled={updatingId === o.order_id}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {viewMode === 'cards' && (
                                <div className="mobile-cards" style={{ padding: 16 }}>
                                    {filtered.length === 0 && (
                                        <div className="empty-state">No orders found</div>
                                    )}
                                    {filtered.map(o => (
                                        <div key={o.order_id} className="order-card">
                                            <div className="order-card-header">
                                                <span className="order-card-id">#{String(o.order_id).padStart(4, '0')}</span>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '4px 8px', fontSize: 12, width: 100 }}
                                                    value={o.status}
                                                    disabled={updatingId === o.order_id}
                                                    onChange={e => handleStatusChange(o.order_id, e.target.value)}
                                                >
                                                    <option>Pending</option>
                                                    <option>Ready</option>
                                                    <option>Delivered</option>
                                                </select>
                                            </div>
                                            <div className="order-card-body">
                                                <div className="order-card-item" style={{ gridColumn: 'span 2' }}>
                                                    <span className="order-card-label">Customer</span>
                                                    <span className="order-card-value">{o.customer_name}</span>
                                                </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Phone</span>
                                                    <span className="order-card-value text-gray">{o.phone_number}</span>
                                                </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Delivery</span>
                                                    <span className="order-card-value" style={{ color: new Date(o.delivery_date) < new Date() && o.status !== 'Delivered' ? '#E65100' : 'inherit' }}>
                                                        {formatDate(o.delivery_date)}
                                                    </span>
                                                </div>
                                                 <div className="order-card-item">
                                                     <span className="order-card-label">Advance</span>
                                                     <span className="order-card-value" style={{ color: '#2E7D32' }}>
                                                         {editingAdvanceId === o.order_id ? (
                                                             <div className="flex gap-4 mt-4">
                                                                 <input
                                                                     type="number"
                                                                     className="form-input"
                                                                     style={{ width: 70, padding: '2px 4px', fontSize: 12, height: 28 }}
                                                                     value={tempAdvanceValue}
                                                                     onChange={e => setTempAdvanceValue(e.target.value)}
                                                                 />
                                                                 <button className="btn btn-sm btn-primary p-4" style={{ minHeight: 'auto' }} onClick={() => handleAdvanceUpdate(o.order_id)}>
                                                                     <Check size={14} />
                                                                 </button>
                                                                 <button className="btn btn-sm btn-ghost p-4" style={{ minHeight: 'auto' }} onClick={() => setEditingAdvanceId(null)}>
                                                                     <X size={14} />
                                                                 </button>
                                                             </div>
                                                         ) : (
                                                             <div className="flex-between w-full">
                                                                 {`\u20b9${parseFloat(o.advance_paid).toLocaleString('en-IN')}`}
                                                                 {!o.isOfflineQueue && (
                                                                 <button
                                                                     className="btn btn-sm btn-ghost p-0"
                                                                     onClick={() => { setEditingAdvanceId(o.order_id); setTempAdvanceValue(o.advance_paid); }}
                                                                 >
                                                                     <Edit2 size={12} />
                                                                 </button>
                                                                 )}
                                                             </div>
                                                         )}
                                                     </span>
                                                 </div>
                                                 <div className="order-card-item">
                                                     <span className="order-card-label">Total Amount</span>
                                                     <span className="order-card-value" style={{ fontWeight: 700 }}>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</span>
                                                 </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Balance</span>
                                                    <span className="order-card-value" style={{ color: parseFloat(o.balance_amount) > 0 ? '#E65100' : '#2E7D32', fontWeight: 700 }}>
                                                        {`\u20b9${parseFloat(o.balance_amount).toLocaleString('en-IN')}`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="order-card-actions">
                                                <Link to={`/customer/${o.customer_id}`} className="btn btn-sm btn-outline">
                                                    <User size={14} /> Measurements
                                                </Link>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                    <Eye size={12} /> Bill
                                                </Link>
                                                {!o.isOfflineQueue && o.status === 'Delivered' && (
                                                    <button
                                                        className="btn btn-sm btn-outline"
                                                        style={{ borderColor: '#2E7D32', color: '#2E7D32' }}
                                                        onClick={() => handleWhatsAppReview(o)}
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                                {!o.isOfflineQueue && (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    title="Delete Order"
                                                    onClick={() => handleDelete(o.order_id)}
                                                    disabled={updatingId === o.order_id}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
