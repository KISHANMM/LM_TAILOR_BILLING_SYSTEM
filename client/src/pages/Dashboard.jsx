import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Package, Clock, CheckCircle, DollarSign,
    Users, ShoppingBag, AlertTriangle, TrendingUp,
    Eye, Plus, ClipboardList, Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

function StatCard({ value, label, icon: Icon, colorClass, iconBg, iconColor }) {
    return (
        <div className={`stat-card ${colorClass}`} style={{ height: '100%', minHeight: '140px', display: 'flex', flexDirection: 'column' }}>
            <div className="stat-icon" style={{ background: iconBg }}>
                <Icon size={20} color={iconColor} />
            </div>
            <div className="stat-value" style={{ flexGrow: 1 }}>{value ?? 0}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

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

export default function Dashboard({ onMenuClick }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dueToday'); // 'dueToday', 'pending', 'ready', 'dueTomorrow', 'overdue'
    const notifiedRef = React.useRef(false);

    useEffect(() => {
        api.get('/dashboard')
            .then(r => {
                setData(r.data);
                
                // Show notifications for due today and tomorrow (Throttled to once every 3 hours)
                const lastNotified = localStorage.getItem('dashboard_toast_time');
                const now = new Date().getTime();
                const threeHours = 3 * 60 * 60 * 1000;
                
                if (!lastNotified || now - parseInt(lastNotified) > threeHours) {
                    if (r.data.dueTodayOrders?.length > 0) {
                        r.data.dueTodayOrders.forEach(order => {
                            toast(`🚚 ${order.customer_name}'s delivery is due today!`, {
                                icon: '🗓️',
                                style: { borderRadius: '10px', background: '#6A1E2E', color: '#fff', fontSize: '14px', fontWeight: '600' },
                            });
                        });
                    }
                    if (r.data.dueTomorrowOrders?.length > 0) {
                        toast(`🔔 ${r.data.dueTomorrowOrders.length} order(s) due tomorrow!`, {
                            icon: '⏰',
                            style: { borderRadius: '10px', background: '#C6A75E', color: '#fff', fontSize: '14px', fontWeight: '600' },
                        });
                    }
                    localStorage.setItem('dashboard_toast_time', now.toString());
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Dashboard</div>
                        <div className="topbar-subtitle">Loading shop overview...</div>
                    </div>
                </div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    const todayStr = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Dashboard</div>
                        <div className="topbar-subtitle">{todayStr}</div>
                    </div>
                </div>
                <Link to="/new-order" className="btn btn-primary">
                    <Plus size={16} /> <span className="hide-mobile">New Order</span>
                </Link>
            </div>

            <div className="page-container">
                {data?.overdueCount > 0 && (
                    <div className="alert alert-warning flex gap-8 mb-16" onClick={() => setActiveTab('overdue')} style={{ cursor: 'pointer' }}>
                        <AlertTriangle size={16} />
                        <strong>{data.overdueCount} order(s)</strong>&nbsp;are overdue and not yet delivered!
                    </div>
                )}

                <div className="grid-4 mb-24">
                    <div onClick={() => setActiveTab('dueToday')} style={{ cursor: 'pointer' }}>
                        <StatCard value={data?.dueToday} label="Due Today" icon={Clock}
                            colorClass={`gold ${activeTab === 'dueToday' ? 'active-stat' : ''}`}
                            iconBg="rgba(198,167,94,0.12)" iconColor="#C6A75E" />
                    </div>
                    <div onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
                        <StatCard value={data?.pendingCount} label="Pending Orders" icon={Package}
                            colorClass={`maroon ${activeTab === 'pending' ? 'active-stat' : ''}`}
                            iconBg="rgba(106,30,46,0.1)" iconColor="#6A1E2E" />
                    </div>
                    <div onClick={() => setActiveTab('ready')} style={{ cursor: 'pointer' }}>
                        <StatCard value={data?.readyCount} label="Ready for Pickup" icon={CheckCircle}
                            colorClass={`green ${activeTab === 'ready' ? 'active-stat' : ''}`}
                            iconBg="rgba(46,125,50,0.1)" iconColor="#2E7D32" />
                    </div>
                    <div onClick={() => setActiveTab('dueTomorrow')} style={{ cursor: 'pointer' }}>
                        <StatCard value={data?.dueTomorrow} label="Due Tomorrow" icon={AlertTriangle}
                            colorClass={`blue ${activeTab === 'dueTomorrow' ? 'active-stat' : ''}`}
                            iconBg="rgba(21,101,192,0.1)" iconColor="#1565C0" />
                    </div>
                </div>

                <div className="grid-2 gap-16">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">
                                {activeTab === 'dueToday' ? 'Due Today' :
                                    activeTab === 'dueTomorrow' ? 'Due Tomorrow' :
                                        activeTab === 'pending' ? 'Pending Orders' : 
                                            activeTab === 'overdue' ? 'Overdue Orders' : 'Ready for Pickup'}
                            </h3>
                            <span className={`badge ${activeTab === 'dueToday' ? 'badge-pending' :
                                activeTab === 'dueTomorrow' ? 'badge-pending' :
                                    activeTab === 'pending' ? 'badge-pending' : 
                                        activeTab === 'overdue' ? 'badge-pending' : 'badge-ready'
                                }`}>
                                {activeTab === 'dueToday' ? data?.dueToday :
                                    activeTab === 'dueTomorrow' ? data?.dueTomorrow :
                                        activeTab === 'pending' ? data?.pendingCount : 
                                            activeTab === 'overdue' ? data?.overdueCount : data?.readyCount} orders
                            </span>
                        </div>
                        <div className="card-body" style={{ padding: 0 }}>
                             {((activeTab === 'dueToday' && !data?.dueTodayOrders?.length) ||
                                (activeTab === 'dueTomorrow' && !data?.dueTomorrowOrders?.length) ||
                                (activeTab === 'pending' && !data?.pendingOrders?.length) ||
                                (activeTab === 'overdue' && !data?.overdueOrders?.length) ||
                                (activeTab === 'ready' && !data?.readyOrders?.length)) ? (
                                <div className="empty-state" style={{ padding: '32px 24px' }}>
                                    <CheckCircle size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                    No {activeTab === 'dueToday' ? 'deliveries due today' :
                                        activeTab === 'dueTomorrow' ? 'deliveries due tomorrow' :
                                            activeTab === 'pending' ? 'pending orders' : 
                                                activeTab === 'overdue' ? 'overdue orders' : 'orders ready for pickup'}
                                </div>
                            ) : (
                                <div
                                    className="table-container"
                                    style={{
                                        borderRadius: 0,
                                        border: 'none',
                                        maxHeight: 360,
                                        overflowY: 'auto',
                                    }}
                                >
                                    <table>
                                        <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                            <tr>
                                                <th>Customer</th><th>Phone</th><th>Delivery</th><th>Status</th><th>Bill</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const list = activeTab === 'dueToday' ? data.dueTodayOrders :
                                                        activeTab === 'dueTomorrow' ? data.dueTomorrowOrders :
                                                        activeTab === 'pending' ? data.pendingOrders : 
                                                        activeTab === 'overdue' ? data.overdueOrders : data.readyOrders;
                                                const limitedList = (list || []).slice(0, 5);
                                                const hasMore = (list || []).length > 5;
                                                const tabMap = { dueToday: 'Pending', dueTomorrow: 'Pending', pending: 'Pending', overdue: 'Overdue', ready: 'Ready' };
                                                const targetStatus = tabMap[activeTab];

                                                return (
                                                    <>
                                                        {limitedList.map(o => (
                                                            <tr key={o.order_id}>
                                                                <td>
                                                                    <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                                        <strong>{o.customer_name}</strong>
                                                                    </Link>
                                                                </td>
                                                                <td style={{ fontSize: 13 }}>{o.phone_number}</td>
                                                                <td style={{ fontSize: 13, color: activeTab === 'overdue' ? '#B71C1C' : 'inherit', fontWeight: activeTab === 'overdue' ? 700 : 500 }}>
                                                                    {o.delivery_date
                                                                        ? new Date(o.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                        : '—'}
                                                                </td>
                                                                <td><StatusBadge status={o.status} /></td>
                                                                <td>
                                                                    <div className="flex gap-8">
                                                                        <Link to={`/customer/${o.customer_id}`} className="btn btn-sm btn-ghost p-4" title="View Measurements">
                                                                            <Users size={14} />
                                                                        </Link>
                                                                        <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                                            <Eye size={12} /> View
                                                                        </Link>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {hasMore && (
                                                            <tr>
                                                                <td colSpan="5" style={{ textAlign: 'center', padding: '16px' }}>
                                                                    <Link to={`/orders?status=${targetStatus}`} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', background: 'var(--blush)' }}>
                                                                        View More ({(list.length - 5)} more)
                                                                    </Link>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="card mb-16">
                            <div className="card-header">
                                <h3 className="card-title">Quick Stats</h3>
                            </div>
                            <div className="card-body">
                                {[
                                    { icon: Users, color: 'var(--gold)', label: 'Total Customers', val: data?.totalCustomers },
                                    { icon: ShoppingBag, color: 'var(--maroon)', label: 'Total Orders', val: data?.totalOrders },
                                    { icon: DollarSign, color: '#2E7D32', label: 'Advance Collected', val: `\u20b9${(data?.totalAdvance || 0).toLocaleString('en-IN')}` },
                                    { icon: AlertTriangle, color: '#E65100', label: 'Overdue', val: data?.overdueCount },
                                ].map(({ icon: Ic, color, label, val }, i) => (
                                    <div key={i} className="flex-between" style={{ padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--gray-light)' : 'none', cursor: label === 'Overdue' ? 'pointer' : 'default' }}
                                        onClick={() => label === 'Overdue' ? setActiveTab('overdue') : null}>
                                        <span className="flex gap-8"><Ic size={15} color={color} />{label}</span>
                                        <strong>{val}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Quick Actions</h3>
                            </div>
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Link to="/new-order" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                                    <Plus size={16} /> Create New Order
                                </Link>
                                <Link to="/search" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                                    <Users size={16} /> Search Customer
                                </Link>
                                <Link to="/orders" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
                                    <ClipboardList size={16} /> View All Orders
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card mt-24">
                    <div className="card-header">
                        <h3 className="card-title">Recent Orders</h3>
                        <Link to="/orders" className="btn btn-sm btn-ghost">View All</Link>
                    </div>
                    <div className="table-container" style={{ border: 'none', maxHeight: 380, overflowY: 'auto' }}>
                        <table>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                                <tr>
                                    <th>#</th><th>Customer</th><th>Phone</th>
                                    <th>Booking</th><th>Delivery</th><th>Amount</th><th>Status</th><th>Bill</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!data?.recentOrders?.length && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>
                                            No orders yet
                                        </td>
                                    </tr>
                                )}
                                {data?.recentOrders?.map(o => (
                                    <tr key={o.order_id}>
                                        <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span></td>
                                        <td>
                                            <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                <strong>{o.customer_name}</strong>
                                            </Link>
                                        </td>
                                        <td style={{ fontSize: 12 }}>{o.phone_number}</td>
                                        <td style={{ fontSize: 12 }}>{formatDate(o.booking_date)}</td>
                                        <td style={{ fontSize: 12 }}>{formatDate(o.delivery_date)}</td>
                                        <td><strong>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</strong></td>
                                        <td><StatusBadge status={o.status} /></td>
                                        <td>
                                            <div className="flex gap-8">
                                                <Link to={`/customer/${o.customer_id}`} className="btn btn-sm btn-ghost p-4" title="View Measurements">
                                                    <Users size={14} />
                                                </Link>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                    <Eye size={12} /> Bill
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style>{`
                .active-stat {
                    box-shadow: 0 0 0 3px var(--gold-light), var(--shadow-lg) !important;
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
}
