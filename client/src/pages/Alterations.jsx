import React, { useState, useEffect, useCallback } from 'react';
import {
    Menu, Scissors, RefreshCw, Calendar, TrendingUp,
    Hash, DollarSign, Plus, Trash2, ChevronDown, ChevronRight,
    ClipboardList, AlertCircle, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayLocal() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDisplay(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
}

const PERIOD_LABELS = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
};

// ─── Analytics Mini Card ──────────────────────────────────────────────────────
function AnalyticCard({ label, entries, total_done, total_amount, accent, bg }) {
    return (
        <div style={{
            background: bg,
            borderRadius: 12,
            padding: '16px 18px',
            border: `1.5px solid ${accent}33`,
            transition: 'transform 0.15s, box-shadow 0.15s',
            cursor: 'default',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
        >
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                {label}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: accent, fontFamily: 'var(--font-serif)', lineHeight: 1 }}>
                        {total_done}
                    </div>
                    <div style={{ fontSize: 11, color: accent, opacity: 0.7, marginTop: 2 }}>alterations done</div>
                </div>
                <div style={{ width: 1, height: 36, background: `${accent}33` }} />
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1 }}>
                        {formatCurrency(total_amount)}
                    </div>
                    <div style={{ fontSize: 11, color: accent, opacity: 0.7, marginTop: 2 }}>amount received</div>
                </div>
                <div style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    color: accent, opacity: 0.6, whiteSpace: 'nowrap'
                }}>
                    {entries} {entries === 1 ? 'entry' : 'entries'}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Alterations({ onMenuClick }) {
    const [dashboard, setDashboard] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activePeriod, setActivePeriod] = useState('today');
    const [showTable, setShowTable] = useState(true);

    // Form state — date always auto-filled to today
    const [form, setForm] = useState({
        date: todayLocal(),
        total_alterations: '',
        amount_received: '',
        description: '',
    });

    // ── Fetch dashboard stats ──────────────────────────────────────────────
    const fetchDashboard = useCallback(() => {
        api.get('/alterations/dashboard')
            .then(res => setDashboard(res.data))
            .catch(() => toast.error('Failed to load dashboard'));
    }, []);

    // ── Fetch records list ─────────────────────────────────────────────────
    const fetchRecords = useCallback((period) => {
        setLoading(true);
        api.get(`/alterations?period=${period}`)
            .then(res => setRecords(res.data))
            .catch(() => toast.error('Failed to load records'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    useEffect(() => {
        fetchRecords(activePeriod);
    }, [activePeriod, fetchRecords]);

    // ── Auto-update date field to today on mount (and keep it current) ─────
    useEffect(() => {
        setForm(f => ({ ...f, date: todayLocal() }));
    }, []);

    // ── Handle form submit ─────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.total_alterations || !form.amount_received) {
            toast.error('Please fill Total Alterations and Amount Received');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/alterations', form);
            toast.success('Alteration record added!');
            setForm({ date: todayLocal(), total_alterations: '', amount_received: '', description: '' });
            fetchDashboard();
            fetchRecords(activePeriod);
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to add record');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Handle delete ──────────────────────────────────────────────────────
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this alteration record?')) return;
        try {
            await api.delete(`/alterations/${id}`);
            toast.success('Record deleted');
            fetchDashboard();
            fetchRecords(activePeriod);
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleRefresh = () => {
        fetchDashboard();
        fetchRecords(activePeriod);
        toast.success('Refreshed!');
    };

    const todayDisplay = dashboard?.today_date
        ? formatDisplay(dashboard.today_date)
        : formatDisplay(todayLocal());

    const analyticsCards = dashboard ? [
        { label: 'Today', ...dashboard.today, accent: '#1565C0', bg: '#EBF3FF' },
        { label: 'This Week', ...dashboard.week, accent: '#6A1E2E', bg: '#FFF0F3' },
        { label: 'This Month', ...dashboard.month, accent: '#E65100', bg: '#FFF3E0' },
        { label: 'This Year', ...dashboard.year, accent: '#2E7D32', bg: '#E8F5E9' },
    ] : [];

    return (
        <div>
            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Scissors size={20} style={{ color: 'var(--gold)' }} />
                            Alterations
                        </div>
                        <div className="topbar-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Calendar size={12} />
                            <strong>{todayDisplay}</strong>
                            &nbsp;— Daily Alteration Tracker
                        </div>
                    </div>
                </div>
                <button className="btn btn-outline" onClick={handleRefresh}>
                    <RefreshCw size={14} />
                    <span className="hide-mobile">Refresh</span>
                </button>
            </div>

            <div className="page-container">

                {/* ── Analytics Dashboard Grid ────────────────────────────── */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <TrendingUp size={16} style={{ color: 'var(--gold)' }} />
                        <span style={{
                            fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 600,
                            color: 'var(--maroon-dark)'
                        }}>Analytics Dashboard</span>
                    </div>

                    {dashboard ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                            {analyticsCards.map(card => (
                                <AnalyticCard key={card.label} {...card} />
                            ))}
                        </div>
                    ) : (
                        <div className="spinner" />
                    )}

                    {/* All-Time Banner */}
                    {dashboard && (
                        <div style={{
                            marginTop: 14,
                            background: 'linear-gradient(135deg, var(--maroon-dark) 0%, var(--maroon-mid) 100%)',
                            borderRadius: 10,
                            padding: '13px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            flexWrap: 'wrap',
                            boxShadow: 'var(--shadow-md)'
                        }}>
                            <Scissors size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap', flex: 1 }}>
                                <span>
                                    All Time Alterations:&nbsp;
                                    <strong style={{ color: 'var(--gold)', fontSize: 15 }}>{dashboard.alltime.total_done}</strong>
                                </span>
                                <span style={{ opacity: 0.4 }}>|</span>
                                <span>
                                    Total Received:&nbsp;
                                    <strong style={{ color: 'var(--gold)', fontSize: 15 }}>{formatCurrency(dashboard.alltime.total_amount)}</strong>
                                </span>
                                <span style={{ opacity: 0.4 }}>|</span>
                                <span>
                                    Total Entries:&nbsp;
                                    <strong style={{ color: 'var(--gold-light)', fontSize: 14 }}>{dashboard.alltime.entries}</strong>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Add New Record Form ──────────────────────────────────── */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title flex gap-8">
                            <Plus size={18} style={{ color: 'var(--gold)' }} />
                            Add Alteration Record
                        </h3>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleSubmit}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                gap: 16,
                                alignItems: 'end'
                            }}>
                                {/* Date — auto-filled, editable */}
                                <div>
                                    <label className="form-label">
                                        <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Date
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        required
                                        style={{ fontWeight: 600 }}
                                    />
                                </div>

                                {/* Total Alterations Done */}
                                <div>
                                    <label className="form-label">
                                        <Hash size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Total Alterations Done
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        className="form-input"
                                        placeholder="e.g. 5"
                                        value={form.total_alterations}
                                        onChange={e => setForm({ ...form, total_alterations: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Amount Received */}
                                <div>
                                    <label className="form-label">
                                        <DollarSign size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Amount Received (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="form-input"
                                        placeholder="e.g. 350"
                                        value={form.amount_received}
                                        onChange={e => setForm({ ...form, amount_received: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* Description (optional) */}
                                <div>
                                    <label className="form-label">Description (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Blouse tightening, zip fix"
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                    />
                                </div>

                                {/* Submit */}
                                <div>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={submitting}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        {submitting ? (
                                            <RefreshCw size={14} className="animate-spin" />
                                        ) : (
                                            <Plus size={16} />
                                        )}
                                        {submitting ? 'Saving...' : 'Add Record'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* ── Period Filter + Records Table ────────────────────────── */}
                <div className="card">
                    {/* Card Header with period tabs */}
                    <div className="card-header" style={{ flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                        <div className="flex-between" style={{ width: '100%' }}>
                            <h3
                                className="card-title flex gap-8"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setShowTable(p => !p)}
                            >
                                <ClipboardList size={18} style={{ color: 'var(--gold)' }} />
                                Alteration Records
                                <span style={{
                                    background: 'var(--gold)',
                                    color: 'var(--maroon-dark)',
                                    borderRadius: 12,
                                    padding: '2px 10px',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-inter)'
                                }}>
                                    {records.length}
                                </span>
                                {showTable ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </h3>
                        </div>

                        {/* Period Tabs */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setActivePeriod(key)}
                                    style={{
                                        padding: '6px 16px',
                                        borderRadius: 20,
                                        border: activePeriod === key
                                            ? '2px solid var(--gold)'
                                            : '2px solid var(--gray-light)',
                                        background: activePeriod === key
                                            ? 'linear-gradient(135deg, var(--gold), var(--gold-deep))'
                                            : 'var(--white)',
                                        color: activePeriod === key ? 'var(--maroon-dark)' : 'var(--gray)',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        transition: 'all 0.18s',
                                        fontFamily: 'var(--font-inter)',
                                        boxShadow: activePeriod === key ? 'var(--shadow-gold)' : 'none',
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table Body */}
                    {showTable && (
                        <div style={{ padding: 0 }}>
                            {loading ? (
                                <div className="spinner" style={{ margin: '30px auto' }} />
                            ) : records.length === 0 ? (
                                <div className="empty-state">
                                    <Scissors size={40} />
                                    <p style={{ marginTop: 12, fontWeight: 600, fontSize: 15 }}>
                                        No alteration records for {PERIOD_LABELS[activePeriod].toLowerCase()}
                                    </p>
                                    <p style={{ fontSize: 13, marginTop: 4, color: 'var(--gray)' }}>
                                        Use the form above to add one right now.
                                    </p>
                                </div>
                            ) : (
                                <div className="table-container" style={{ border: 'none' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 50 }}>SL.No</th>
                                                <th>Date</th>
                                                <th>Total Alterations Done</th>
                                                <th>Amount Received</th>
                                                <th>Description</th>
                                                <th style={{ width: 60 }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.map((row, idx) => (
                                                <tr key={row.id}>
                                                    <td style={{
                                                        fontWeight: 700,
                                                        color: 'var(--gray)',
                                                        fontSize: 13,
                                                        textAlign: 'center'
                                                    }}>
                                                        {idx + 1}
                                                    </td>
                                                    <td style={{ fontWeight: 600, fontSize: 13 }}>
                                                        {formatDisplay(row.date)}
                                                    </td>
                                                    <td>
                                                        <div style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            background: 'rgba(198,167,94,0.1)',
                                                            border: '1px solid rgba(198,167,94,0.3)',
                                                            borderRadius: 20,
                                                            padding: '4px 14px',
                                                            fontWeight: 800,
                                                            fontSize: 15,
                                                            color: 'var(--maroon-dark)',
                                                            fontFamily: 'var(--font-serif)'
                                                        }}>
                                                            <Hash size={13} style={{ color: 'var(--gold-deep)' }} />
                                                            {row.total_alterations}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span style={{
                                                            fontWeight: 700,
                                                            fontSize: 15,
                                                            color: '#2E7D32',
                                                            fontFamily: 'var(--font-serif)'
                                                        }}>
                                                            {formatCurrency(row.amount_received)}
                                                        </span>
                                                    </td>
                                                    <td style={{
                                                        fontSize: 13,
                                                        color: row.description ? 'var(--charcoal)' : 'var(--gray)',
                                                        fontStyle: row.description ? 'normal' : 'italic'
                                                    }}>
                                                        {row.description || 'No description'}
                                                    </td>
                                                    <td>
                                                        <button
                                                            onClick={() => handleDelete(row.id)}
                                                            className="btn btn-danger btn-sm"
                                                            title="Delete record"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        {/* Summary Footer Row */}
                                        {records.length > 0 && (
                                            <tfoot>
                                                <tr style={{
                                                    background: 'var(--maroon-dark)',
                                                    color: 'var(--gold-pale)',
                                                    fontWeight: 700
                                                }}>
                                                    <td colSpan={2} style={{ padding: '12px 16px', fontSize: 12, letterSpacing: '0.05em', color: 'var(--gold)' }}>
                                                        TOTAL — {PERIOD_LABELS[activePeriod].toUpperCase()}
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: 16, color: 'var(--gold)', fontFamily: 'var(--font-serif)' }}>
                                                        {records.reduce((s, r) => s + Number(r.total_alterations || 0), 0)} alterations
                                                    </td>
                                                    <td style={{ padding: '12px 16px', fontSize: 16, color: 'var(--gold)', fontFamily: 'var(--font-serif)' }}>
                                                        {formatCurrency(records.reduce((s, r) => s + Number(r.amount_received || 0), 0))}
                                                    </td>
                                                    <td colSpan={2} style={{ padding: '12px 16px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                                        {records.length} entries
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
