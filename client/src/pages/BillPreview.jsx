import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Download, Share2, Printer, ChevronLeft, CheckCircle, Clock, Menu, Image as ImageIcon, X, Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { getOfflineOrders } from '../utils/offlineStore';

function StatusBadge({ status }) {
    const cls = { Pending: 'badge badge-pending', Ready: 'badge badge-ready', Delivered: 'badge badge-delivered' }[status] || 'badge';
    return <span className={cls}>{status}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function BillPreview({ onMenuClick }) {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [images, setImages] = useState([]);
    const [voiceNotes, setVoiceNotes] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusUpdating, setStatusUpdating] = useState(false);

    useEffect(() => {
        if (orderId && orderId.toString().startsWith('offline-')) {
            const queueId = parseInt(orderId.replace('offline-', ''), 10);
            getOfflineOrders().then(orders => {
                const queuedOrder = orders.find(o => o.id === queueId);
                if (!queuedOrder) {
                    toast.error('Offline order not found');
                    setLoading(false);
                    return;
                }
                
                const p = queuedOrder.orderPayload;
                const total = p.services.reduce((s, svc) => s + (parseFloat(svc.price) * parseInt(svc.quantity)), 0);
                const pseudoOrder = {
                    order_id: 'Offline Pending',
                    customer_name: queuedOrder.customer?.name || 'Unknown',
                    phone_number: queuedOrder.customer?.phone_number || '',
                    booking_date: p.booking_date,
                    delivery_date: p.delivery_date,
                    total_amount: total,
                    advance_paid: p.advance_paid,
                    balance_amount: total - p.advance_paid,
                    status: 'Pending',
                    measurement_type: p.measurement_type,
                    notes: p.notes,
                    services: p.services,
                    created_at: new Date(queuedOrder.timestamp || Date.now()).toISOString()
                };

                setOrder(pseudoOrder);
                setImages(queuedOrder.images ? queuedOrder.images.map((img, i) => ({ id: `img-${i}`, image_data: img })) : []);
                setVoiceNotes(queuedOrder.audioData ? [{ id: 'vn-1', audio_data: queuedOrder.audioData, duration: queuedOrder.recordingTime }] : []);
                setLoading(false);
            }).catch(() => {
                toast.error('Failed to load offline order');
                setLoading(false);
            });
            return;
        }

        Promise.all([
            api.get(`/orders/${orderId}`),
            api.get(`/orders/${orderId}/images`).catch(() => ({ data: [] })), 
            api.get(`/orders/${orderId}/voice-notes`).catch(() => ({ data: [] }))
        ])
            .then(([orderRes, imgRes, voiceRes]) => {
                setOrder(orderRes.data);
                setImages(imgRes.data);
                setVoiceNotes(voiceRes.data);
            })
            .catch(() => toast.error('Order not found'))
            .finally(() => setLoading(false));
    }, [orderId]);

    async function handleClearBalance() {
        if (!window.confirm('Is the amount cleared? Settle the remaining bill?')) return;
        setStatusUpdating(true);
        try {
            await api.put(`/orders/${orderId}`, {
                advance_paid: order.total_amount,
                services: order.services // preserve services
            });
            // Re-fetch to ensure all calculated fields (like balance) are fresh from DB
            const res = await api.get(`/orders/${orderId}`);
            setOrder(res.data);
            toast.success('Balance cleared successfully');
        } catch {
            toast.error('Failed to clear balance');
        } finally {
            setStatusUpdating(false);
        }
    }

    function handlePrint() {
        if (!order) return;
        const originalTitle = document.title;

        // Format the customer name for a clean filename (e.g. "Jane_Doe_Bill_0012")
        const safeName = (order.customer_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
        const oIdStr = order.order_id === 'Offline Pending' ? 'Offline' : String(order.order_id).padStart(4, '0');
        document.title = `${safeName}_Bill_${oIdStr}`;

        window.print();

        // Restore original title after a slight delay to ensure the print dialog catches the new title
        setTimeout(() => {
            document.title = originalTitle;
        }, 1000);
    }

    function handleWhatsApp() {
        if (!order) return;
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

        const msg = encodeURIComponent(
            `*LM Ladies Tailor - Bill*\n\n` +
            `Customer: ${order.customer_name}\n` +
            `Phone: ${order.phone_number}\n` +
            `Order #${String(order.order_id).padStart(4, '0')}\n` +
            `Booking: ${formatDate(order.booking_date)}\n` +
            `Delivery: ${formatDate(order.delivery_date)}\n\n` +
            `*Services:*\n` +
            order.services.map(s => `• ${s.service_type} x${s.quantity} = \u20b9${(parseFloat(s.price) * s.quantity).toFixed(2)}`).join('\n') +
            `\n\n*Total: \u20b9${parseFloat(order.total_amount).toFixed(2)}*\n` +
            `Advance Paid: \u20b9${parseFloat(order.advance_paid).toFixed(2)}\n` +
            `*Balance Due: \u20b9${parseFloat(order.balance_amount).toFixed(2)}*\n\n` +
            `_LM Ladies Tailor | Dajibanpeth, Beside Ganesh Temple, Hubli | 9916562127_`
        );
        window.open(`https://wa.me/${phoneForUrl}?text=${msg}`, '_blank');
    }

    function handleWhatsAppReview() {
        if (!order) return;
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

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
    }

    const handleWhatsAppReady = (order) => {
        let phoneForUrl = order.phone_number.replace(/\D/g, '');
        if (phoneForUrl.length === 10) phoneForUrl = '91' + phoneForUrl;

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

    async function handleStatusChange(newStatus) {
        setStatusUpdating(true);
        try {
            await api.put(`/orders/${orderId}/status`, { status: newStatus });
            setOrder(o => {
                const updated = { ...o, status: newStatus };
                if (newStatus === 'Ready') {
                    handleWhatsAppReady(updated);
                }
                return updated;
            });
            toast.success(`Status updated to ${newStatus}`);
        } catch {
            toast.error('Status update failed');
        } finally {
            setStatusUpdating(false);
        }
    }

    if (loading) return (
        <div>
            <div className="topbar">
                <div className="topbar-title">Bill Preview</div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    if (!order) return (
        <div className="page-container">
            <div className="empty-state">Order not found. <Link to="/">Go to Dashboard</Link></div>
        </div>
    );

    const subtotal = order.services?.reduce((s, svc) => s + parseFloat(svc.price) * svc.quantity, 0) || 0;

    return (
        <div>
            {/* Top bar */}
            <div className="topbar flex-between no-print">
                <div className="flex gap-12">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <button className="btn btn-ghost hide-mobile" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} /> Back
                    </button>
                    <div>
                        <div className="topbar-title">Bill {order.order_id === 'Offline Pending' ? '(Offline)' : `#${String(order.order_id).padStart(4, '0')}`}</div>
                        <div className="topbar-subtitle">{order.customer_name}</div>
                    </div>
                </div>
                <div className="flex gap-8">
                    {/* Status updater */}
                    <select
                        className="form-select hide-mobile"
                        style={{ width: 130, padding: '8px 12px', fontSize: 13 }}
                        value={order.status}
                        disabled={statusUpdating}
                        onChange={e => handleStatusChange(e.target.value)}
                    >
                        <option>Pending</option>
                        <option>Ready</option>
                        <option>Delivered</option>
                    </select>
                    <button className="btn btn-outline" onClick={handleWhatsApp}><Share2 size={16} /> <span className="hide-mobile">WhatsApp</span></button>
                    <button className="btn btn-primary" onClick={handlePrint}><Printer size={16} /> <span className="hide-mobile">Print / Save PDF</span></button>
                </div>
            </div>

            <div className="page-container">
                <div className="bill-preview-layout">

                    {/* ── Bill Preview ─────────────────────── */}
                    <div style={{ flex: 1, maxWidth: 580 }}>
                        <div className="bill-preview" id="bill-content">
                            {/* Header */}
                            <div className="bill-header">
                                <div style={{ borderBottom: '1px solid rgba(198,167,94,0.3)', paddingBottom: 12, marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(198,167,94,0.6)', marginBottom: 6, textTransform: 'uppercase' }}>
                                        Receipt
                                    </div>
                                    <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--gold)', letterSpacing: '0.1em' }}>
                                        LM LADIES TAILOR
                                    </h1>
                                    <p style={{ fontSize: 11, marginTop: 4 }}>✦ Luxury in Every Stitch ✦</p>
                                </div>
                                <p style={{ fontSize: 11, color: 'rgba(198,167,94,0.7)' }}>
                                    DAJIBANPETH, BESIDE GANESH TEMPLE, HUBLI
                                </p>
                                <p style={{ fontSize: 11, color: 'rgba(198,167,94,0.7)', marginTop: 3 }}>
                                    📞 9916562127
                                </p>
                            </div>

                            {/* Bill Meta */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--blush)', borderBottom: '1px solid var(--gray-light)', fontSize: 12 }}>
                                <span><strong>Bill #:</strong> {order.order_id === 'Offline Pending' ? 'Pending Sync' : String(order.order_id).padStart(4, '0')}</span>
                                <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</span>
                                {order.order_id === 'Offline Pending' ? (
                                    <span className="badge" style={{ background: '#FFF3E0', color: '#E65100' }}>Pending Sync</span>
                                ) : (
                                    <StatusBadge status={order.status} />
                                )}
                            </div>

                            {/* Customer Details */}
                            <div className="bill-section">
                                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: 'var(--maroon)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Customer Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 13 }}>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Name</span>
                                        <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Phone</span>
                                        <div style={{ fontWeight: 600 }}>{order.phone_number}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Order Date</span>
                                        <div>{formatDate(order.booking_date)}</div>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--gray)', fontSize: 11 }}>Delivery Date</span>
                                        <div style={{ fontWeight: 600, color: 'var(--maroon)' }}>{formatDate(order.delivery_date)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="gold-divider" style={{ margin: 0 }} />

                            {/* Services Table */}
                            <div style={{ padding: '0 0' }}>
                                <div style={{ padding: '10px 20px 6px', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 700, color: 'var(--maroon)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Services
                                </div>
                                <table className="bill-table">
                                    <thead>
                                        <tr>
                                            <th>Service</th>
                                            <th style={{ textAlign: 'center' }}>Qty</th>
                                            <th style={{ textAlign: 'right' }}>Price</th>
                                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.services?.map((svc, i) => {
                                            const sub = parseFloat(svc.price) * svc.quantity;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 500 }}>{svc.service_type}</td>
                                                    <td style={{ textAlign: 'center' }}>{svc.quantity}</td>
                                                    <td style={{ textAlign: 'right' }}>{`\u20b9${parseFloat(svc.price).toFixed(2)}`}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{`\u20b9${sub.toFixed(2)}`}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment Summary */}
                            <div className="bill-totals">
                                <div className="bill-total-row">
                                    <span style={{ color: 'var(--gray)' }}>Subtotal</span>
                                    <span>{`\u20b9${subtotal.toFixed(2)}`}</span>
                                </div>
                                <div className="bill-total-row">
                                    <span style={{ color: '#2E7D32' }}>Advance Paid</span>
                                    <span style={{ color: '#2E7D32', fontWeight: 600 }}>{`- \u20b9${parseFloat(order.advance_paid).toFixed(2)}`}</span>
                                </div>
                                <div className="gold-divider" style={{ margin: '8px 0' }} />
                                <div className="bill-total-row highlight">
                                    <span>Balance Due</span>
                                    <span>{`\u20b9${parseFloat(order.balance_amount).toFixed(2)}`}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="bill-section" style={{ borderTop: '1px solid var(--gray-light)' }}>
                                    <span style={{ fontSize: 11, color: 'var(--gray)', fontStyle: 'italic' }}>
                                        Note: {order.notes}
                                    </span>
                                </div>
                            )}



                            {/* Footer */}
                            <div style={{ background: 'var(--maroon-dark)', color: 'rgba(198,167,94,0.6)', textAlign: 'center', padding: '14px 20px', fontSize: 11, borderTop: '2px solid var(--gold)' }}>
                                <div>Thank you for choosing LM Ladies Tailor!</div>
                                <div style={{ marginTop: 3, fontSize: 10 }}>This is a computer-generated receipt. No signature required.</div>
                            </div>
                        </div>

                        {/* Attached Images (Not Printed) */}
                        {images.length > 0 && (
                            <div className="no-print" style={{ marginTop: 24, background: '#fff', padding: 20, borderRadius: 12, border: '1px solid var(--gray-light)' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--maroon-dark)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ImageIcon size={18} /> Reference Images
                                </h3>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {images.map(img => (
                                        <div key={img.id}
                                            onClick={() => setPreviewImage(img.image_data)}
                                            style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--gray-light)' }}>
                                            <img src={img.image_data} alt="Design Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Voice Notes — Standalone Card (Not Printed) */}
                        {voiceNotes.length > 0 && (
                            <div className="no-print" style={{ marginTop: 24, background: '#fff', padding: 20, borderRadius: 12, border: '2px solid #FFCDD2' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#B71C1C', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Mic size={18} color="#D32F2F" /> Voice Instructions
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {voiceNotes.map((vn, idx) => (
                                        <div key={vn.id} style={{ background: '#FFEBEE', borderRadius: 10, padding: '10px 14px', border: '1px solid #FFCDD2' }}>
                                            <div style={{ fontSize: 12, color: '#B71C1C', marginBottom: 6, fontWeight: 600 }}>
                                                🎙️ Recording {voiceNotes.length > 1 ? `#${idx + 1}` : ''}
                                                {vn.duration ? ` · ${Math.floor(vn.duration / 60)}:${String(vn.duration % 60).padStart(2, '0')}` : ''}
                                            </div>
                                            <audio
                                                src={vn.audio_data}
                                                controls
                                                style={{ width: '100%', height: 40, outline: 'none', borderRadius: 8 }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Action buttons below bill */}
                        <div className="flex gap-8 mt-16 no-print" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-outline" onClick={handleWhatsApp}><Share2 size={15} /> WhatsApp Bill</button>
                            <button className="btn btn-primary" onClick={handlePrint}><Printer size={15} /> Print / Save PDF</button>
                            {order.status === 'Delivered' && (
                                <button className="btn btn-outline" style={{ borderColor: '#2E7D32', color: '#2E7D32' }} onClick={handleWhatsAppReview}>
                                    <CheckCircle size={15} /> Request Review
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Order Summary Sidebar ───────────────── */}
                    <div className="bill-sidebar no-print">
                        <div className="card mb-16">
                            <div className="card-header">
                                <h3 className="card-title">Order Status</h3>
                            </div>
                            <div className="card-body">
                                {['Pending', 'Ready', 'Delivered'].map((s, i) => (
                                    <div key={s} className="flex gap-12" style={{ marginBottom: i < 2 ? 14 : 0, alignItems: 'center' }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            background: order.status === s ? 'var(--gold)' : order.status === 'Delivered' && i < 2 ? 'var(--gold)' : order.status === 'Ready' && i < 1 ? 'var(--gold)' : 'var(--gray-light)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>
                                            {(order.status === s || (order.status === 'Delivered' && i < 2) || (order.status === 'Ready' && i < 1))
                                                ? <CheckCircle size={16} color="var(--maroon-dark)" />
                                                : <Clock size={14} color="var(--gray)" />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: order.status === s ? 700 : 400 }}>{s}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="card mb-16">
                            <div className="card-header"><h3 className="card-title">Payment</h3></div>
                            <div className="card-body">
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: 'var(--gray)', fontSize: 13 }}>Total</span>
                                    <strong>{`\u20b9${parseFloat(order.total_amount).toLocaleString('en-IN')}`}</strong>
                                </div>
                                <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <span style={{ color: '#2E7D32', fontSize: 13 }}>Advance</span>
                                    <span style={{ color: '#2E7D32', fontWeight: 600 }}>{`\u20b9${parseFloat(order.advance_paid).toLocaleString('en-IN')}`}</span>
                                </div>
                                <div className="gold-divider" style={{ margin: '8px 0' }} />
                                <div className="flex-between">
                                    <span style={{ fontWeight: 700 }}>Balance</span>
                                    <strong style={{ fontSize: 18, color: parseFloat(order.balance_amount) > 0 ? '#E65100' : '#2E7D32' }}>
                                        {`\u20b9${parseFloat(order.balance_amount).toLocaleString('en-IN')}`}
                                    </strong>
                                </div>
                                {order.status !== 'Pending' && parseFloat(order.balance_amount) > 0 && (
                                    <button
                                        className="btn btn-primary mt-12 w-full"
                                        onClick={handleClearBalance}
                                        disabled={statusUpdating}
                                        style={{ width: '100%', marginTop: 16 }}
                                    >
                                        <CheckCircle size={15} /> Clear Balance
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header"><h3 className="card-title">Quick Links</h3></div>
                            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Link to="/" className="btn btn-ghost" style={{ justifyContent: 'center' }}>Dashboard</Link>
                                <Link to="/new-order" className="btn btn-outline" style={{ justifyContent: 'center' }}>New Order</Link>
                                <Link to="/orders" className="btn btn-ghost" style={{ justifyContent: 'center' }}>All Orders</Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @media print {
          .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .sidebar { display: none !important; }
          .page-container { padding: 0 !important; }
          .topbar { display: none !important; }
          body { 
            background: white !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
          }
          .bill-preview { box-shadow: none !important; max-width: 100% !important; border: none !important; }
        }
      `}</style>

            {/* Image Preview Modal */}
            {previewImage && (
                <div
                    onClick={() => setPreviewImage(null)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
                >
                    <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain' }} />
                </div>
            )}
        </div>
    );
}
