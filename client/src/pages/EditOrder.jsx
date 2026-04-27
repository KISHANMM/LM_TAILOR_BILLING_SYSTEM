import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Trash2, Scissors, CreditCard, Menu,
    ChevronLeft, Save, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const SERVICE_TYPES = ['Blouse', 'Dress', 'Lehenga', 'Chudi', 'Alteration', 'Pico', 'Fall', 'Gonda', 'Krosha Work', 'Other'];

const initialService = () => ({ service_type: 'Blouse', quantity: 1, price: '', custom_type: '' });

export default function EditOrder({ onMenuClick }) {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const submittingRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [order, setOrder] = useState(null);

    // Editable fields
    const [deliveryDate, setDeliveryDate] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [notes, setNotes] = useState('');
    const [advancePaid, setAdvancePaid] = useState('');
    const [assignedWorker, setAssignedWorker] = useState('');
    const [services, setServices] = useState([]);

    // ── Load existing order ───────────────────────────
    useEffect(() => {
        api.get(`/orders/${orderId}`)
            .then(res => {
                const o = res.data;
                setOrder(o);
                setDeliveryDate(o.delivery_date || '');
                setBookingDate(o.booking_date || '');
                setNotes(o.notes || '');
                setAdvancePaid(String(o.advance_paid ?? ''));
                setAssignedWorker(o.assigned_worker || '');
                // Map services — keep custom_type for 'Other' detection
                const mapped = (o.services || []).map(s => ({
                    service_type: s.service_type,
                    quantity: s.quantity,
                    price: String(s.price),
                    custom_type: '',   // DB doesn't store this separately; user can re-specify if needed
                }));
                setServices(mapped.length > 0 ? mapped : [initialService()]);
            })
            .catch(() => toast.error('Failed to load order'))
            .finally(() => setLoading(false));
    }, [orderId]);

    // ── Service helpers ───────────────────────────────
    function addService() { setServices(s => [...s, initialService()]); }
    function removeService(i) { setServices(s => s.filter((_, idx) => idx !== i)); }
    function updateService(i, field, val) {
        setServices(s => s.map((svc, idx) => idx === i ? { ...svc, [field]: val } : svc));
    }

    // ── Computed totals ───────────────────────────────
    const totalAmount = services.reduce((s, svc) => {
        const qty = parseFloat(svc.quantity) || 0;
        const price = parseFloat(svc.price) || 0;
        return s + qty * price;
    }, 0);
    const advance = parseFloat(advancePaid) || 0;
    const balance = totalAmount - advance;

    // ── Submit ────────────────────────────────────────
    async function handleSave(e) {
        e.preventDefault();
        if (submittingRef.current) return;

        if (!deliveryDate) return toast.error('Please set a delivery date');
        if (services.length === 0) return toast.error('At least one service is required');
        if (services.some(s => !s.price || parseFloat(s.price) <= 0)) {
            return toast.error('All services must have a valid price');
        }
        if (advance > totalAmount) {
            return toast.error('Advance paid cannot exceed total amount');
        }

        submittingRef.current = true;
        setSaving(true);

        const svcList = services.map(s => ({
            service_type: s.service_type === 'Other' ? (s.custom_type || 'Other') : s.service_type,
            quantity: parseInt(s.quantity) || 1,
            price: parseFloat(s.price),
        }));

        try {
            await api.put(`/orders/${orderId}`, {
                booking_date: bookingDate,
                delivery_date: deliveryDate,
                advance_paid: advance,
                notes: notes || '',
                services: svcList,
                assigned_worker: assignedWorker,
            });
            toast.success('Bill updated successfully!');
            navigate(`/bill/${orderId}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Failed to update order');
            submittingRef.current = false;
        } finally {
            setSaving(false);
        }
    }

    // ── Loading / not found ───────────────────────────
    if (loading) return (
        <div>
            <div className="topbar">
                <div className="topbar-title">Edit Bill</div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    if (!order) return (
        <div className="page-container">
            <div className="empty-state">Order not found.</div>
        </div>
    );

    return (
        <div>
            {/* Full-screen saving overlay */}
            {saving && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(20,5,9,0.95)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 20,
                }}>
                    <div style={{
                        width: 64, height: 64,
                        border: '4px solid rgba(198,167,94,0.2)',
                        borderTop: '4px solid var(--gold)',
                        borderRight: '4px solid rgba(198,167,94,0.5)',
                        borderRadius: '50%',
                        animation: 'spin 0.75s linear infinite',
                    }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                            Saving Changes...
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(198,167,94,0.7)' }}>
                            Updating order · Please wait
                        </div>
                    </div>
                </div>
            )}

            {/* Top bar */}
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <button className="btn btn-ghost hide-mobile" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} /> Back
                    </button>
                    <div>
                        <div className="topbar-title">
                            Edit Bill #{String(order.order_id).padStart(4, '0')}
                        </div>
                        <div className="topbar-subtitle">{order.customer_name}</div>
                    </div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                >
                    <Save size={15} /> Save Changes
                </button>
            </div>

            <div className="page-container">
                {/* Info Banner */}
                <div className="card mb-16" style={{ background: '#FFF8E1', border: '1.5px solid #FFD54F' }}>
                    <div className="card-body" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} color="#F57F17" />
                        <span style={{ fontSize: 13, color: '#5D4037', fontWeight: 500 }}>
                            You are editing an existing order. Changes will update the bill and recalculate the total & balance.
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSave}>

                    {/* ─── CUSTOMER INFO (read-only) ─────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title">Customer</h3>
                        </div>
                        <div className="card-body">
                            <div className="grid-2">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={order.customer_name} readOnly disabled style={{ background: 'var(--gray-light)', cursor: 'not-allowed' }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Phone</label>
                                    <input className="form-input" value={order.phone_number} readOnly disabled style={{ background: 'var(--gray-light)', cursor: 'not-allowed' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── DATES ────────────────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title">Dates</h3>
                        </div>
                        <div className="card-body">
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Booking Date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={bookingDate}
                                        onChange={e => setBookingDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Delivery Date *</label>
                                    <input
                                        className="form-input"
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Notes / Special Instructions</label>
                                <input
                                    className="form-input"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Any special instructions..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── SERVICES ─────────────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8">
                                <Scissors size={18} color="var(--gold)" /> Services
                            </h3>
                            <button type="button" className="btn btn-sm btn-outline" onClick={addService}>
                                <Plus size={14} /> Add Row
                            </button>
                        </div>
                        <div className="card-body">
                            {/* Header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.2fr auto', gap: 12, marginBottom: 8 }}>
                                <span className="form-label">Service Type</span>
                                <span className="form-label">Qty</span>
                                <span className="form-label">Price (₹)</span>
                                <span />
                            </div>

                            {services.map((svc, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1.2fr auto', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                                    <div>
                                        <select
                                            className="form-select"
                                            value={svc.service_type}
                                            onChange={e => updateService(i, 'service_type', e.target.value)}
                                        >
                                            {SERVICE_TYPES.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                        {svc.service_type === 'Other' && (
                                            <input
                                                className="form-input mt-8"
                                                placeholder="Specify service..."
                                                value={svc.custom_type}
                                                onChange={e => updateService(i, 'custom_type', e.target.value)}
                                                required
                                            />
                                        )}
                                    </div>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        value={svc.quantity}
                                        onChange={e => updateService(i, 'quantity', e.target.value)}
                                        required
                                    />
                                    <div className="input-prefix">
                                        <span className="prefix-symbol">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={svc.price}
                                            onChange={e => updateService(i, 'price', e.target.value)}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-danger"
                                        onClick={() => removeService(i)}
                                        disabled={services.length === 1}
                                        style={{ padding: '10px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}

                            {/* Subtotals */}
                            {services.length > 0 && (
                                <div style={{ background: 'var(--blush)', borderRadius: 8, padding: '12px 16px', marginTop: 8 }}>
                                    {services.map((svc, i) => {
                                        const sub = (parseFloat(svc.price) || 0) * (parseFloat(svc.quantity) || 0);
                                        return (
                                            <div key={i} className="flex-between" style={{ fontSize: 13, padding: '3px 0' }}>
                                                <span>{svc.service_type === 'Other' ? svc.custom_type || 'Other' : svc.service_type} × {svc.quantity}</span>
                                                <strong>₹{sub.toFixed(2)}</strong>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ─── PAYMENT SUMMARY ──────────────────── */}
                    <div className="card mb-16">
                        <div className="card-header">
                            <h3 className="card-title flex gap-8">
                                <CreditCard size={18} color="var(--gold)" /> Payment Summary
                            </h3>
                        </div>
                        <div className="card-body">
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Advance Paid (₹)</label>
                                    <div className="input-prefix">
                                        <span className="prefix-symbol">₹</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={advancePaid}
                                            onChange={e => setAdvancePaid(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Assigned Worker</label>
                                    <select
                                        className="form-select"
                                        value={assignedWorker}
                                        onChange={e => setAssignedWorker(e.target.value)}
                                    >
                                        <option value="Praveen">Praveen</option>
                                        <option value="Lata">Lata</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            {/* Totals card */}
                            <div style={{
                                background: 'var(--maroon-dark)', borderRadius: 12,
                                padding: '16px 20px', marginTop: 8
                            }}>
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: 'rgba(198,167,94,0.7)', fontSize: 13 }}>Total Amount</span>
                                    <strong style={{ color: 'var(--gold)', fontSize: 16 }}>₹{totalAmount.toLocaleString('en-IN')}</strong>
                                </div>
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: '#81C784', fontSize: 13 }}>Advance Paid</span>
                                    <span style={{ color: '#81C784', fontWeight: 600 }}>₹{advance.toLocaleString('en-IN')}</span>
                                </div>
                                <div style={{ borderTop: '1px solid rgba(198,167,94,0.2)', paddingTop: 8 }} className="flex-between">
                                    <span style={{ color: '#fff', fontWeight: 700 }}>Balance Due</span>
                                    <strong style={{
                                        fontSize: 20,
                                        color: balance > 0 ? '#FF8A65' : '#81C784'
                                    }}>
                                        ₹{balance.toLocaleString('en-IN')}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── SUBMIT ────────────────────────────── */}
                    <div className="flex gap-12" style={{ justifyContent: 'flex-end', marginBottom: 40 }}>
                        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
