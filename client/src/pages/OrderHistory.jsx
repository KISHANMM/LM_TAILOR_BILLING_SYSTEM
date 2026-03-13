import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Filter, RefreshCw, Menu } from 'lucide-react';
import api from '../api/axios';

function StatusBadge({ status }) {
    const cls = { Pending: 'badge badge-pending', Ready: 'badge badge-ready', Delivered: 'badge badge-delivered' }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_OPTIONS = ['All', 'Pending', 'Ready', 'Delivered'];

export default function OrderHistory({ onMenuClick }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    function fetchOrders() {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter !== 'All') params.set('status', statusFilter);
        if (dateFilter) params.set('date', dateFilter);
        if (search) params.set('search', search);
        api.get(`/orders?${params}`)
            .then(r => setOrders(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }

    useEffect(() => { fetchOrders(); }, [statusFilter, dateFilter]);

    async function handleStatusChange(orderId, newStatus) {
        setUpdatingId(orderId);
        try {
            await api.put(`/orders/${orderId}/status`, { status: newStatus });
            setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: newStatus } : o));
        } catch { /* silent */ } finally {
            setUpdatingId(null);
        }
    }

    const filtered = orders.filter(o => {
        if (!search) return true;
        return o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
            o.phone_number.includes(search);
    });

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
                <button className="btn btn-ghost" onClick={fetchOrders}>
                    <RefreshCw size={15} /> <span className="hide-mobile">Refresh</span>
                </button>
            </div>

            <div className="page-container">
                {/* Filters */}
                <div className="card mb-20">
                    <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div style={{ flex: 2, minWidth: 200 }}>
                            <label className="form-label"><Search size={12} style={{ marginRight: 4 }} />Search</label>
                            <input
                                className="form-input"
                                placeholder="Customer name or phone..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && fetchOrders()}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 140 }}>
                            <label className="form-label"><Filter size={12} style={{ marginRight: 4 }} />Status</label>
                            <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                            <label className="form-label">Delivery Date</label>
                            <input
                                className="form-input"
                                type="date"
                                value={dateFilter}
                                onChange={e => setDateFilter(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-primary" onClick={fetchOrders}>Apply</button>
                        <button className="btn btn-ghost" onClick={() => { setSearch(''); setStatusFilter('All'); setDateFilter(''); }}>Clear</button>
                    </div>
                </div>

                {/* Status filter tabs */}
                <div className="flex gap-8 mb-16">
                    {STATUS_OPTIONS.map(s => (
                        <button
                            key={s}
                            className={`btn btn-sm ${statusFilter === s ? 'btn-maroon' : 'btn-ghost'}`}
                            onClick={() => setStatusFilter(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="card">
                    <div className="table-container" style={{ border: 'none' }}>
                        {loading ? (
                            <div className="spinner" />
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Customer</th>
                                        <th>Phone</th>
                                        <th>Booking</th>
                                        <th>Delivery</th>
                                        <th>Total</th>
                                        <th>Advance</th>
                                        <th>Balance</th>
                                        <th>Status</th>
                                        <th>Bill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--gray)' }}>
                                                No orders found
                                            </td>
                                        </tr>
                                    )}
                                    {filtered.map(o => (
                                        <tr key={o.order_id}>
                                            <td>
                                                <span style={{ fontWeight: 700, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span>
                                            </td>
                                            <td>
                                                <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                    <strong>{o.customer_name}</strong>
                                                </Link>
                                            </td>
                                            <td style={{ fontSize: 12 }}>{o.phone_number}</td>
                                            <td style={{ fontSize: 12 }}>{formatDate(o.booking_date)}</td>
                                            <td style={{ fontSize: 12, color: new Date(o.delivery_date) < new Date() && o.status !== 'Delivered' ? '#E65100' : 'inherit' }}>
                                                {formatDate(o.delivery_date)}
                                            </td>
                                            <td><strong>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</strong></td>
                                            <td style={{ color: '#2E7D32', fontSize: 13 }}>{`\u20b9${parseFloat(o.advance_paid).toLocaleString('en-IN')}`}</td>
                                            <td style={{ color: parseFloat(o.balance_amount) > 0 ? '#E65100' : '#2E7D32', fontWeight: 600, fontSize: 13 }}>
                                                {`\u20b9${parseFloat(o.balance_amount).toLocaleString('en-IN')}`}
                                            </td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    style={{ padding: '4px 8px', fontSize: 12, width: 110 }}
                                                    value={o.status}
                                                    disabled={updatingId === o.order_id}
                                                    onChange={e => handleStatusChange(o.order_id, e.target.value)}
                                                >
                                                    <option>Pending</option>
                                                    <option>Ready</option>
                                                    <option>Delivered</option>
                                                </select>
                                            </td>
                                            <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                    <Eye size={12} /> Bill
                                                </Link>
                                                {o.status === 'Delivered' && (
                                                    <button
                                                        className="btn btn-sm btn-outline"
                                                        style={{ borderColor: '#2E7D32', color: '#2E7D32', padding: '4px 8px' }}
                                                        onClick={(e) => { e.stopPropagation(); handleWhatsAppReview(o); }}
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
