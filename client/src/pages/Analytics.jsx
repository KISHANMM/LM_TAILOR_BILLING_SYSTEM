import React, { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Menu,
    ChevronDown, ChevronRight, Download, Star, Award,
    BarChart2, Calendar, RefreshCw, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const CATEGORIES = [
    'PRAVEEN', 'RENUKA', 'JAIRULL', 'SADDAM', 'KHALIM',
    'Fabric/Material', 'Thread/Accessories', 'Electricity', 'Rent', 'Maintenance', 'Other'
];

const fmt = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

/* ── Period stat row: 4 big clear cards ─────────────────────────────────── */
function PeriodCards({ income, expense, profit, balance, loading }) {
    const cards = [
        { label: 'Income',   value: income,  bg: '#6A1E2E', border: '#a0304a', icon: TrendingUp },
        { label: 'Expenses', value: expense, bg: '#b71c1c', border: '#d32f2f', icon: TrendingDown },
        {
            label: profit >= 0 ? 'Profit' : 'Loss',
            value: Math.abs(profit),
            bg: profit >= 0 ? '#1b5e20' : '#4a148c',
            border: profit >= 0 ? '#2e7d32' : '#6a1b9a',
            icon: DollarSign,
        },
        {
            label: 'Balance',
            value: balance,
            bg: '#E65100',
            border: '#EF6C00',
            icon: Layers,
        },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {cards.map(({ label, value, bg, border, icon: Icon }) => (
                <div key={label} style={{
                    background: bg,
                    border: `2px solid ${border}`,
                    borderRadius: 12,
                    padding: '20px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    boxShadow: '0 3px 12px rgba(0,0,0,0.18)',
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.18)',
                        borderRadius: 10,
                        padding: 10,
                        flexShrink: 0,
                    }}>
                        <Icon size={22} color="#fff" />
                    </div>
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 600, marginBottom: 4, letterSpacing: '0.02em' }}>
                            {label}
                        </div>
                        {loading ? (
                            <div style={{ height: 32, width: 100, background: 'rgba(255,255,255,0.2)', borderRadius: 6 }} />
                        ) : (
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-0.01em', fontFamily: 'var(--font-inter)' }}>
                                {fmt(value)}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ── Collapsible section wrapper ────────────────────────────────────────── */
function Section({ title, isOpen, onToggle, children, badge, accentColor }) {
    return (
        <div style={{
            marginBottom: 14,
            borderRadius: 12,
            overflow: 'hidden',
            border: `1.5px solid ${isOpen ? accentColor + '44' : '#e5e7eb'}`,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
            <button
                onClick={onToggle}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: isOpen ? accentColor + '0d' : '#f9fafb',
                    border: 'none',
                    borderBottom: isOpen ? `1.5px solid ${accentColor}22` : 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-inter)',
                    transition: 'background 0.2s',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: '#1A0A10' }}>{title}</span>
                    {badge && (
                        <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.08em', color: accentColor,
                            background: accentColor + '18',
                            border: `1px solid ${accentColor}33`,
                            borderRadius: 20, padding: '2px 9px',
                        }}>{badge}</span>
                    )}
                </div>
                <div style={{
                    color: '#6B7280',
                    transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                }}>
                    <ChevronDown size={20} />
                </div>
            </button>
            {isOpen && <div style={{ padding: '16px 18px 18px' }}>{children}</div>}
        </div>
    );
}

/* ── Expense list row ───────────────────────────────────────────────────── */
function ExpenseRow({ exp, onDelete }) {
    const isWorker = ['PRAVEEN', 'RENUKA', 'JAIRULL', 'SADDAM', 'KHALIM'].includes(exp.category);
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            marginBottom: 6,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 700,
                        background: isWorker ? 'rgba(106,30,46,0.1)' : 'rgba(21,101,192,0.1)',
                        color: isWorker ? '#6A1E2E' : '#0D47A1',
                        border: `1px solid ${isWorker ? 'rgba(106,30,46,0.25)' : 'rgba(21,101,192,0.25)'}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}>
                        {exp.category}
                    </span>
                    {exp.description && (
                        <span style={{ fontSize: 13, color: '#3A3A3C', fontWeight: 500 }}>
                            {exp.description}
                        </span>
                    )}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                    {new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#b71c1c', flexShrink: 0 }}>
                {fmt(exp.amount)}
            </div>
            {exp.type !== 'stitching' && (
                <button
                    onClick={() => onDelete(exp.id)}
                    title="Delete"
                    style={{
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: '#9CA3AF',
                        padding: 5, borderRadius: 6,
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.15s, background 0.15s',
                        flexShrink: 0,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#b71c1c'; e.currentTarget.style.background = '#fff1f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'none'; }}
                >
                    <Trash2 size={15} />
                </button>
            )}
        </div>
    );
}

/* ── Main Component ─────────────────────────────────────────────────────── */
export default function Analytics({ onMenuClick }) {
    const [summary, setSummary] = useState({
        today_income: 0, today_expense: 0, today_profit: 0, today_balance: 0,
        monthly_income: 0, monthly_expense: 0, monthly_profit: 0, monthly_balance: 0,
        yearly_income: 0, yearly_expense: 0, yearly_profit: 0, yearly_balance: 0,
        total_income: 0, total_expense: 0, net_profit: 0, total_balance: 0,
    });
    const [expenses, setExpenses] = useState([]);
    const [topServices, setTopServices] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [monthlyRecords, setMonthlyRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [expanded, setExpanded] = useState({ today: false, month: false, year: false, allTime: false });
    const toggle = (k) => setExpanded(p => ({ ...p, [k]: !p[k] }));

    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'PRAVEEN',
        amount: '',
        description: '',
    });

    const fetchData = () => {
        setLoading(true);
        api.get('/analytics/dashboard')
            .then(res => {
                const { summary, expenses, services, customers, monthlyRecords } = res.data;
                setSummary(summary);
                setExpenses(expenses);
                setTopServices(services);
                setTopCustomers(customers);
                setMonthlyRecords(monthlyRecords || []);
            })
            .catch(() => toast.error('Failed to load analytics'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/analytics/expenses', form);
            toast.success('Expense recorded');
            setForm(f => ({ ...f, amount: '', description: '' }));
            fetchData();
        } catch {
            toast.error('Failed to add expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await api.delete(`/analytics/expenses/${id}`);
            toast.success('Expense deleted');
            fetchData();
        } catch {
            toast.error('Failed to delete');
        }
    };

    const handleExport = () => {
        const header = 'Date,Category,Amount,Description\n';
        const csv = expenses.map(e =>
            `${new Date(e.date).toLocaleDateString('en-IN')},"${e.category}",${e.amount},"${e.description || ''}"`
        ).join('\n');
        const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Exported');
    };

    const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div>
            {/* ── Top Bar ───────────────────────────────────────────────── */}
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}><Menu size={22} /></button>
                    <div>
                        <div className="topbar-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <BarChart2 size={20} style={{ color: 'var(--gold)' }} />
                            Analytics
                        </div>
                        <div className="topbar-subtitle">Income &amp; Expense · {todayStr}</div>
                    </div>
                </div>
                <div className="flex gap-8">
                    <button className="btn btn-ghost btn-sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span className="hide-mobile">Refresh</span>
                    </button>
                    <button className="btn btn-outline" onClick={handleExport}>
                        <Download size={15} />
                        <span className="hide-mobile">Export CSV</span>
                    </button>
                </div>
            </div>

            <div className="page-container">

                {/* ── Period Summary Sections ────────────────────────────── */}
                <div style={{ marginBottom: 20 }}>
                    <Section title="Today" isOpen={expanded.today} onToggle={() => toggle('today')} badge="Live" accentColor="#6A1E2E">
                        <PeriodCards income={summary.today_income} expense={summary.today_expense} profit={summary.today_profit} balance={summary.today_balance} loading={loading} />
                    </Section>

                    <Section title="This Month" isOpen={expanded.month} onToggle={() => toggle('month')} accentColor="#1565C0">
                        <PeriodCards income={summary.monthly_income} expense={summary.monthly_expense} profit={summary.monthly_profit} balance={summary.monthly_balance} loading={loading} />
                    </Section>

                    <Section title="This Year" isOpen={expanded.year} onToggle={() => toggle('year')} accentColor="#2E7D32">
                        <PeriodCards income={summary.yearly_income} expense={summary.yearly_expense} profit={summary.yearly_profit} balance={summary.yearly_balance} loading={loading} />
                    </Section>

                    <Section title="All Time" isOpen={expanded.allTime} onToggle={() => toggle('allTime')} accentColor="#5c35a6">
                        <PeriodCards income={summary.total_income} expense={summary.total_expense} profit={summary.net_profit} balance={summary.total_balance} loading={loading} />
                    </Section>
                </div>

                {/* ── Top Services & Customers ───────────────────────────── */}
                <div className="grid-2 mb-24">
                    {/* Top Services */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Star size={17} color="var(--gold)" fill="var(--gold)" />
                                Top Services
                            </h3>
                            <span style={{ fontSize: 12, color: 'var(--gray)' }}>by revenue</span>
                        </div>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Service</th>
                                        <th>Orders</th>
                                        <th>Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topServices.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--gray)', fontSize: 14 }}>No data yet</td></tr>
                                    ) : topServices.map((t, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 800, fontSize: 15 }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </td>
                                            <td style={{ fontSize: 15, fontWeight: 700 }}>{t.service_type}</td>
                                            <td>
                                                <span style={{
                                                    background: '#E3F2FD', color: '#1565C0',
                                                    borderRadius: 20, padding: '3px 12px',
                                                    fontSize: 14, fontWeight: 800,
                                                }}>{t.count}</span>
                                            </td>
                                            <td style={{ color: '#1B5E20', fontWeight: 800, fontSize: 15 }}>
                                                {fmt(t.revenue)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Top Customers */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Award size={17} color="var(--gold)" fill="var(--gold)" />
                                Top Customers
                            </h3>
                            <span style={{ fontSize: 12, color: 'var(--gray)' }}>by spend</span>
                        </div>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Customer</th>
                                        <th>Orders</th>
                                        <th>Spent</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topCustomers.length === 0 ? (
                                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--gray)', fontSize: 14 }}>No data yet</td></tr>
                                    ) : topCustomers.map((c, i) => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 800, fontSize: 15 }}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 34, height: 34, borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, var(--gold), var(--gold-deep))',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 14, fontWeight: 800, color: 'var(--maroon-dark)',
                                                        flexShrink: 0,
                                                    }}>
                                                        {c.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--gray)' }}>{c.phone_number}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    background: '#E3F2FD', color: '#1565C0',
                                                    borderRadius: 20, padding: '3px 12px',
                                                    fontSize: 14, fontWeight: 800,
                                                }}>{c.order_count}</span>
                                            </td>
                                            <td style={{ color: '#1B5E20', fontWeight: 800, fontSize: 15 }}>
                                                {fmt(c.total_spent)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ── Add Expense + Monthly Records ──────────────────────── */}
                <div className="grid-2">

                    {/* Add Expense */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Plus size={17} style={{ color: 'var(--gold)' }} />
                                Record Expense
                            </h3>
                        </div>
                        <div className="card-body">
                            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label className="form-label">Date</label>
                                        <input type="date" className="form-input" required
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="form-label">Category</label>
                                        <select className="form-select" value={form.category}
                                            onChange={e => setForm({ ...form, category: e.target.value })}>
                                            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Amount (₹)</label>
                                    <div className="input-prefix">
                                        <span className="prefix-symbol">₹</span>
                                        <input type="number" step="0.01" min="0" required placeholder="0.00"
                                            value={form.amount}
                                            onChange={e => setForm({ ...form, amount: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Description (Optional)</label>
                                    <input type="text" className="form-input" placeholder="e.g., 5m red silk fabric"
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary" disabled={submitting}
                                    style={{ marginTop: 4, justifyContent: 'center', width: '100%', fontSize: 15, padding: '11px 18px' }}>
                                    {submitting ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={16} />}
                                    {submitting ? 'Saving...' : 'Record Expense'}
                                </button>
                            </form>

                            {/* Recent expenses */}
                            {expenses.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--gray)', marginBottom: 10 }}>
                                        Recent Expenses
                                    </div>
                                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                                        {expenses.slice(0, 12).map(exp => (
                                            <ExpenseRow key={`${exp.id}-${exp.type}`} exp={exp} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Monthly Records */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={17} style={{ color: 'var(--gold)' }} />
                                Monthly Records
                            </h3>
                        </div>
                        <div style={{ padding: 0 }}>
                            {loading ? (
                                <div className="spinner" style={{ margin: '24px auto' }} />
                            ) : (
                                <div className="table-container" style={{ border: 'none', maxHeight: 500, overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Month</th>
                                                <th>Income</th>
                                                <th>Expense</th>
                                                <th>Profit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyRecords.length === 0 ? (
                                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--gray)', fontSize: 14 }}>No records yet</td></tr>
                                            ) : (() => {
                                                let currentYear = null;
                                                return monthlyRecords.map((m) => {
                                                    const date = new Date(m.month + '-01');
                                                    const year = date.getFullYear();
                                                    const monthName = date.toLocaleDateString('en-IN', { month: 'long' });
                                                    const showYear = year !== currentYear;
                                                    if (showYear) currentYear = year;
                                                    const isProfit = m.profit >= 0;

                                                    return (
                                                        <React.Fragment key={m.month}>
                                                            {showYear && (
                                                                <tr style={{ background: 'var(--maroon-dark)' }}>
                                                                    <td colSpan={4} style={{
                                                                        padding: '8px 16px',
                                                                        fontWeight: 800,
                                                                        fontSize: 13,
                                                                        color: 'var(--gold)',
                                                                        letterSpacing: '0.15em',
                                                                        textTransform: 'uppercase',
                                                                    }}>
                                                                        {year}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                            <tr>
                                                                <td style={{ fontWeight: 700, fontSize: 15, paddingLeft: 20 }}>
                                                                    {monthName}
                                                                </td>
                                                                <td style={{ color: '#1B5E20', fontWeight: 800, fontSize: 15 }}>
                                                                    {fmt(m.total)}
                                                                </td>
                                                                <td style={{ color: '#B71C1C', fontWeight: 800, fontSize: 15 }}>
                                                                    {fmt(m.expense)}
                                                                </td>
                                                                <td>
                                                                    <span style={{
                                                                        display: 'inline-block',
                                                                        fontWeight: 800,
                                                                        fontSize: 15,
                                                                        color: '#fff',
                                                                        background: isProfit ? '#2E7D32' : '#B71C1C',
                                                                        borderRadius: 8,
                                                                        padding: '4px 12px',
                                                                        minWidth: 90,
                                                                        textAlign: 'center',
                                                                    }}>
                                                                        {isProfit ? '+' : '-'}{fmt(Math.abs(m.profit))}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                });
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
