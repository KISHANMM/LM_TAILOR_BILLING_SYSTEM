import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, Phone, User, ShoppingBag, Plus, Eye, Ruler, Edit2, Check, X, Menu, LayoutGrid, List } from 'lucide-react';
import api from '../api/axios';
import { searchOfflineCustomers, getOfflineCustomerById } from '../utils/offlineStore';

const BLOUSE_LABELS = {
    m_length: 'Length', shoulder: 'Shoulder', chest: 'Chest', waist: 'Waist',
    dot: 'Dot', back_neck: 'Back Neck', front_neck: 'Front Neck',
    sleeves_length: 'Sleeves Length', armhole: 'Armhole',
    chest_distance: 'Chest Distance', sleeves_round: 'Sleeves Round',
};

const CHUDHIDHAR_LABELS = {
    t_length: 'Length', t_shoulder: 'Shoulder', t_chest: 'Chest', t_waist: 'Waist',
    t_back_neck: 'Back Neck', t_front_neck: 'Front Neck', t_sleeves_length: 'Sleeves Length',
    t_sleeves_round: 'Round', t_half_body: 'Half Body', t_hip: 'HIP',
    b_length: 'B-Length (BL)', b_bottom_round: 'B-Round (BR)', b_hip: 'B-Hip (HP)',
    b_fly: 'B-Fly (FLY)', b_thai: 'B-Thai', b_knee: 'B-Knee'
};

const ALL_LABELS = { ...BLOUSE_LABELS, ...CHUDHIDHAR_LABELS };

function StatusBadge({ status }) {
    const cls = { Pending: 'badge badge-pending', Ready: 'badge badge-ready', Delivered: 'badge badge-delivered' }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CustomerSearch({ onMenuClick }) {
    const { id } = useParams();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editInfoForm, setEditInfoForm] = useState({});
    const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'cards' : 'table');
    const [activeTab, setActiveTab] = useState('BLOUSE'); // 'BLOUSE' or 'CHUDHIDHAR'

    useEffect(() => {
        if (id) {
            handleSelectById(id);
        }
    }, [id]);

    async function handleSelectById(cid) {
        setLoading(true);
        try {
            if (String(cid).startsWith('temp-')) {
                const offlineCust = await getOfflineCustomerById(cid);
                setSelected(offlineCust ? { ...offlineCust, orders: [], isOfflineQueue: true } : null);
            } else {
                const [apiRes, offlineCust] = await Promise.all([
                    api.get(`/customers/${cid}`).catch(() => null),
                    getOfflineCustomerById(cid).catch(() => null)
                ]);
                setSelected(apiRes?.data || offlineCust || null);
            }
            setSearched(true);
        } catch {
            setSelected(null);
        } finally {
            setLoading(false);
        }
    }

    const debouncedSearch = useCallback((q) => {
        const handler = setTimeout(async () => {
            if (!q) {
                setResults([]);
                setSearched(false);
                return;
            }
            setLoading(true);
            setSearched(true);
            try {
                const param = /^\\d+$/.test(q) ? `phone=${q}` : `name=${q}`;
                const [apiRes, offlineRes] = await Promise.all([
                    api.get(`/customers/search?${param}`).catch(() => ({ data: [] })),
                    searchOfflineCustomers(q).catch(() => [])
                ]);
                const apiData = apiRes.data || [];
                const livePhones = new Set(apiData.map(c => String(c.phone_number)));
                const liveIds = new Set(apiData.map(c => String(c.id)));
                
                const uniqueOffline = (offlineRes || []).filter(c => 
                    !liveIds.has(String(c.id)) && !livePhones.has(String(c.phone_number))
                );
                
                setResults([...uniqueOffline, ...apiData]);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, []);

    useEffect(() => {
        if (query && !selected) {
            return debouncedSearch(query);
        } else if (!query) {
            setResults([]);
            setSearched(false);
        }
    }, [query, debouncedSearch, selected]);

    async function handleSearch(e) {
        e && e.preventDefault();
        if (!query) return;
        setLoading(true);
        setSelected(null);
        setSearched(true);
        try {
            const param = /^\\d+$/.test(query) ? `phone=${query}` : `name=${query}`;
            const [apiRes, offlineRes] = await Promise.all([
                api.get(`/customers/search?${param}`).catch(() => ({ data: [] })),
                searchOfflineCustomers(query).catch(() => [])
            ]);
            const apiData = apiRes.data || [];
            const livePhones = new Set(apiData.map(c => String(c.phone_number)));
            const liveIds = new Set(apiData.map(c => String(c.id)));
            
            const uniqueOffline = (offlineRes || []).filter(c => 
                !liveIds.has(String(c.id)) && !livePhones.has(String(c.phone_number))
            );
            
            setResults([...uniqueOffline, ...apiData]);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }

    async function handleSelect(customer) {
        setIsEditing(false); // Reset editing mode when selecting a new customer
        try {
            if (String(customer.id).startsWith('temp-')) {
                const offlineCust = await getOfflineCustomerById(customer.id);
                setSelected(offlineCust ? { ...offlineCust, orders: [], isOfflineQueue: true } : customer);
            } else {
                const [apiRes, offlineCust] = await Promise.all([
                    api.get(`/customers/${customer.id}`).catch(() => null),
                    getOfflineCustomerById(customer.id).catch(() => null)
                ]);
                setSelected(apiRes?.data || offlineCust || customer);
            }
        } catch {
            setSelected(customer);
        }
    }

    function handleStartEdit() {
        const form = {};
        Object.keys(ALL_LABELS).forEach(k => {
            form[k] = selected[k] !== null && selected[k] !== undefined ? selected[k] : '';
        });
        setEditForm(form);
        setIsEditing(true);
    }

    function handleCancelEdit() {
        setIsEditing(false);
        setEditForm({});
    }

    async function handleSaveEdit() {
        setLoading(true);
        try {
            await api.put(`/customers/${selected.id}/measurements`, editForm);
            // Refresh selected customer data to see changes
            const res = await api.get(`/customers/${selected.id}`);
            setSelected(res.data);
            setIsEditing(false);
            setEditForm({});
        } catch (err) {
            console.error('Failed to save measurements:', err);
        } finally {
            setLoading(false);
        }
    }

    function handleStartEditInfo() {
        setEditInfoForm({
            name: selected.name,
            phone_number: selected.phone_number
        });
        setIsEditingInfo(true);
    }

    function handleCancelEditInfo() {
        setIsEditingInfo(false);
        setEditInfoForm({});
    }

    async function handleSaveEditInfo() {
        setLoading(true);
        try {
            await api.put(`/customers/${selected.id}`, editInfoForm);
            // Refresh selected customer data to see changes
            const res = await api.get(`/customers/${selected.id}`);
            setSelected(res.data);
            setIsEditingInfo(false);
            setEditInfoForm({});
        } catch (err) {
            console.error('Failed to save customer info:', err);
            alert(err.response?.data?.error || 'Failed to update customer info');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Customer Search</div>
                        <div className="topbar-subtitle">Find or view customer profile</div>
                    </div>
                </div>
                <Link to="/new-order" className="btn btn-primary"><Plus size={16} /> New Order</Link>
            </div>

            <div className="page-container">
                {/* Search Box */}
                <div className="card mb-24">
                    <div className="card-body">
                        <form onSubmit={handleSearch}>
                            <div className="flex gap-12">
                                <div className="input-prefix" style={{ flex: 1 }}>
                                    <span className="prefix-symbol"><Search size={15} /></span>
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={e => {
                                            setQuery(e.target.value);
                                            if (selected) setSelected(null); // Clear selection when typing to show live results
                                        }}
                                        placeholder="Enter phone number or customer name..."
                                        autoFocus
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={!query || loading} style={{ display: 'none' }}>
                                    {loading ? 'Searching…' : 'Search'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Results List */}
                {searched && !selected && (
                    <div className="card mb-24">
                        <div className="card-header">
                            <h3 className="card-title">
                                {results.length > 0 ? `${results.length} customer(s) found` : 'No results found'}
                            </h3>
                        </div>
                        {results.length === 0 ? (
                            <div className="empty-state">
                                <User size={40} />
                                <p>No customer found matching "{query}"</p>
                                <Link to="/new-order" className="btn btn-primary mt-16">
                                    <Plus size={16} /> Create New Order
                                </Link>
                            </div>
                        ) : (
                            <div className="table-container" style={{ border: 'none' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Customer Name</th>
                                            <th>Phone</th>
                                            <th>Member Since</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map(c => (
                                            <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => handleSelect(c)}>
                                                <td>
                                                    <strong>
                                                        <User size={13} style={{ marginRight: 6, color: 'var(--gold)' }} />
                                                        {c.name}
                                                        {String(c.id).startsWith('temp-') && <span style={{ marginLeft: 8, color: '#E65100', fontSize: 11, fontWeight: 'normal' }}>(Offline)</span>}
                                                    </strong>
                                                </td>
                                                <td><Phone size={12} style={{ marginRight: 4 }} />{c.phone_number}</td>
                                                <td style={{ fontSize: 12 }}>{c.created_at ? formatDate(c.created_at) : 'Pending Sync'}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); handleSelect(c); }}>
                                                        <Eye size={12} /> View Profile
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Customer Profile */}
                {selected && (
                    <div>
                        <button className="btn btn-ghost mb-16" onClick={() => setSelected(null)}>
                            ← Back to results
                        </button>

                        <div className="grid-2 gap-16 mb-24">
                            {/* Info card */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title flex gap-8">
                                        <User size={18} color="var(--gold)" /> Customer Info
                                        {selected.isOfflineQueue && <span style={{ color: '#E65100', fontSize: 12, marginLeft: 8 }}>(Pending Sync)</span>}
                                    </h3>
                                    {!isEditingInfo ? (
                                        <div className="flex gap-8">
                                            <a href={`tel:${selected.phone_number}`} className="btn btn-sm btn-outline" style={{ color: '#2E7D32', borderColor: '#2E7D32' }} title="Call Customer">
                                                <Phone size={13} /> Call
                                            </a>
                                            {!selected.isOfflineQueue && (
                                            <button className="btn btn-sm btn-outline" onClick={handleStartEditInfo} title="Edit Info">
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-8">
                                            <button className="btn btn-sm btn-ghost" onClick={handleCancelEditInfo} style={{ color: 'var(--maroon)' }}>
                                                <X size={14} /> Cancel
                                            </button>
                                            <button className="btn btn-sm btn-primary" onClick={handleSaveEditInfo} disabled={loading}>
                                                <Check size={14} /> {loading ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="card-body">
                                    <div style={{ marginBottom: 12 }}>
                                        {isEditingInfo ? (
                                            <div className="flex-column gap-8">
                                                <div>
                                                    <label className="form-label" style={{ fontSize: 11 }}>Name</label>
                                                    <input
                                                        className="form-input"
                                                        value={editInfoForm.name || ''}
                                                        onChange={e => setEditInfoForm({ ...editInfoForm, name: e.target.value })}
                                                        style={{ height: 32, fontSize: 14 }}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label" style={{ fontSize: 11 }}>Phone</label>
                                                    <input
                                                        className="form-input"
                                                        value={editInfoForm.phone_number || ''}
                                                        onChange={e => setEditInfoForm({ ...editInfoForm, phone_number: e.target.value })}
                                                        style={{ height: 32, fontSize: 14 }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--maroon-dark)' }}>
                                                    {selected.name}
                                                </div>
                                                <div className="flex gap-8 mt-4" style={{ color: 'var(--gray)', fontSize: 13 }}>
                                                    <Phone size={14} /> {selected.phone_number}
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 6 }}>
                                                    Customer since {formatDate(selected.created_at)}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Measurements card */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title flex gap-8"><Ruler size={18} color="var(--gold)" /> Measurements</h3>
                                    {!isEditing ? (
                                        !selected.isOfflineQueue && (
                                        <button className="btn btn-sm btn-outline" onClick={handleStartEdit} title="Edit Measurements">
                                            <Edit2 size={13} /> Edit
                                        </button>
                                        )
                                    ) : (
                                        <div className="flex gap-8">
                                            <button className="btn btn-sm btn-ghost" onClick={handleCancelEdit} style={{ color: 'var(--maroon)' }}>
                                                <X size={14} /> Cancel
                                            </button>
                                            <button className="btn btn-sm btn-primary" onClick={handleSaveEdit} disabled={loading}>
                                                <Check size={14} /> {loading ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="card-body">
                                    {/* Tabs */}
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--gray-light)', paddingBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                        <button className={`btn btn-sm ${activeTab === 'BLOUSE' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('BLOUSE')} style={{ fontSize: 11 }}>BLOUSE</button>
                                        <button className={`btn btn-sm ${activeTab === 'CHUDHIDHAR' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('CHUDHIDHAR')} style={{ fontSize: 11 }}>CHUDHIDHAR</button>
                                    </div>

                                    {(() => {
                                        const labels = activeTab === 'BLOUSE' ? BLOUSE_LABELS : CHUDHIDHAR_LABELS;
                                        const hasData = Object.keys(labels).some(k => selected[k] != null && selected[k] !== '');
                                        
                                        if (!isEditing && !hasData) {
                                            return <div className="empty-state" style={{ padding: '16px 0', fontSize: 13 }}>No {activeTab.toLowerCase()} measurements recorded</div>;
                                        }

                                        return (
                                            <div className="grid-2" style={{ gap: 10 }}>
                                                {Object.entries(labels).map(([key, label]) => (
                                                    <div key={key} className="flex-between" style={{ padding: '4px 8px', background: 'var(--ivory)', borderRadius: 6 }}>
                                                        <span style={{ fontSize: 12, color: 'var(--gray)' }}>{label}</span>
                                                        {isEditing ? (
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={editForm[key] || ''}
                                                                onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                                                                style={{
                                                                    width: 70,
                                                                    height: 24,
                                                                    fontSize: 13,
                                                                    border: '1px solid var(--gold-pale)',
                                                                    borderRadius: 4,
                                                                    padding: '0 4px',
                                                                    background: 'white'
                                                                }}
                                                            />
                                                        ) : (
                                                            <strong style={{ fontSize: 13 }}>{selected[key] != null && selected[key] !== '' ? `${selected[key]}"` : '-'}</strong>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Order history */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title flex gap-8"><ShoppingBag size={18} color="var(--gold)" /> Order History</h3>
                                <div className="flex gap-16">
                                    <div className="flex gap-4 p-4" style={{ background: 'var(--gray-light)', borderRadius: 8 }}>
                                        <button
                                            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setViewMode('table')}
                                            style={{ padding: '4px 8px', minHeight: 'auto', border: 'none' }}
                                        >
                                            <List size={14} />
                                        </button>
                                        <button
                                            className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setViewMode('cards')}
                                            style={{ padding: '4px 8px', minHeight: 'auto', border: 'none' }}
                                        >
                                            <LayoutGrid size={14} />
                                        </button>
                                    </div>
                                    <span className="badge" style={{ background: 'var(--blush)', color: 'var(--maroon)', border: '1px solid var(--gold-pale)' }}>
                                        {selected.orders?.length || 0} orders
                                    </span>
                                </div>
                            </div>
                            {!selected.orders?.length ? (
                                <div className="card-body">
                                    <div className="empty-state">No orders found for this customer.</div>
                                </div>
                            ) : (
                                <div className="card-body" style={{ padding: 0 }}>
                                    {viewMode === 'table' && (
                                        <div className="table-container" style={{ border: 'none', display: 'block' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>#</th><th>Booking</th><th>Delivery</th>
                                                        <th>Amount</th><th>Advance</th><th>Balance</th><th>Status</th><th>Bill</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selected.orders.map(o => (
                                                        <tr key={o.order_id}>
                                                            <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span></td>
                                                            <td style={{ fontSize: 12 }}>{formatDate(o.booking_date)}</td>
                                                            <td style={{ fontSize: 12 }}>{formatDate(o.delivery_date)}</td>
                                                            <td><strong>{`\u20b9${parseFloat(o.total_amount).toLocaleString('en-IN')}`}</strong></td>
                                                            <td style={{ color: '#2E7D32' }}>{`\u20b9${parseFloat(o.advance_paid).toLocaleString('en-IN')}`}</td>
                                                            <td style={{ color: parseFloat(o.balance_amount) > 0 ? '#E65100' : '#2E7D32', fontWeight: 600 }}>
                                                                {`\u20b9${parseFloat(o.balance_amount).toLocaleString('en-IN')}`}
                                                            </td>
                                                            <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                                                            <td>
                                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                                    <Eye size={12} /> Bill
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {viewMode === 'cards' && (
                                        <div className="mobile-cards" style={{ padding: 16, display: 'flex' }}>
                                            {selected.orders.map(o => (
                                                <div key={o.order_id} className="order-card">
                                                    <div className="order-card-header">
                                                        <span className="order-card-id">#{String(o.order_id).padStart(4, '0')}</span>
                                                        <span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span>
                                                    </div>
                                                    <div className="order-card-body">
                                                        <div className="order-card-item">
                                                            <span className="order-card-label">Booking</span>
                                                            <span className="order-card-value text-gray">{formatDate(o.booking_date)}</span>
                                                        </div>
                                                        <div className="order-card-item">
                                                            <span className="order-card-label">Delivery</span>
                                                            <span className="order-card-value">{formatDate(o.delivery_date)}</span>
                                                        </div>
                                                        <div className="order-card-item">
                                                            <span className="order-card-label">Amount</span>
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
                                                        <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                            <Eye size={12} /> Bill
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
