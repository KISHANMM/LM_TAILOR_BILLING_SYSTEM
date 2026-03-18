import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Plus, Trash2, Menu, ChevronDown, ChevronRight, Download, Star, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const CATEGORIES = ['PRAVEEN', 'RENUKA', 'JAIRULL', 'SADDAM', 'KHALIM', 'Fabric/Material', 'Thread/Accessories', 'Electricity', 'Rent', 'Maintenance', 'Other'];

export default function Analytics({ onMenuClick }) {
    const [summary, setSummary] = useState({
        today_income: 0, today_expense: 0, today_profit: 0,
        monthly_income: 0, monthly_expense: 0, monthly_profit: 0,
        yearly_income: 0, yearly_expense: 0, yearly_profit: 0,
        total_income: 0, total_expense: 0, net_profit: 0
    });
    const [expenses, setExpenses] = useState([]);
    const [topServices, setTopServices] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedSections, setExpandedSections] = useState({
        today: true,
        month: true,
        year: true,
        allTime: false
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Form state
    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        category: 'PRAVEEN',
        amount: '',
        description: ''
    });

    const fetchData = () => {
        setLoading(true);
        api.get('/analytics/dashboard')
            .then(res => {
                const { summary, expenses, services, customers } = res.data;
                setSummary(summary);
                setExpenses(expenses);
                setTopServices(services);
                setTopCustomers(customers);
            }).catch(err => {
                toast.error('Failed to load analytics');
                console.error(err);
            }).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('/analytics/expenses', form);
            toast.success('Expense added successfully');
            setForm({ ...form, amount: '', description: '' });
            fetchData();
        } catch (err) {
            toast.error('Failed to add expense');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await api.delete(`/analytics/expenses/${id}`);
            toast.success('Expense deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete expense');
        }
    };

    const handleExport = () => {
        const header = "Date,Category,Amount,Description\n";
        const csv = expenses.map(e => `${new Date(e.date).toLocaleDateString('en-IN')},"${e.category}",${e.amount},"${e.description || ''}"`).join('\n');
        const blob = new Blob([header + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `expenses_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Export successful");
    };

    function StatCard({ label, value, colorClass, icon: Icon }) {
        return (
            <div className={`card ${colorClass}`} style={{ flex: 1, minWidth: 200 }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ padding: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                        <Icon size={24} />
                    </div>
                    <div>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>₹{value.toLocaleString('en-IN')}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Analytics</div>
                        <div className="topbar-subtitle">Income & Expense Tracking</div>
                    </div>
                </div>
                <button className="btn btn-outline" onClick={handleExport}>
                    <Download size={16} /> <span className="hide-mobile">Export CSV</span>
                </button>
            </div>

            <div className="page-container">
                {/* Summary Cards */}
                {/* Summary Cards */}
                <div style={{ marginBottom: 24 }}>
                    {/* Today Section */}
                    <div style={{ marginBottom: 16 }}>
                        <div
                            className="flex-between"
                            style={{ cursor: 'pointer', padding: '12px 16px', background: 'var(--ivory)', borderRadius: 8, border: '1px solid var(--gray-light)' }}
                            onClick={() => toggleSection('today')}
                        >
                            <h3 className="card-title" style={{ margin: 0 }}>Today Overview</h3>
                            {expandedSections.today ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                        {expandedSections.today && (
                            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                                <StatCard label="Income" value={summary.today_income || 0} colorClass="bg-maroon" icon={TrendingUp} />
                                <StatCard label="Expenses" value={summary.today_expense || 0} colorClass="bg-red" icon={TrendingDown} />
                                <StatCard label="Profit" value={summary.today_profit || 0} colorClass="bg-green" icon={DollarSign} />
                            </div>
                        )}
                    </div>

                    {/* This Month Section */}
                    <div style={{ marginBottom: 16 }}>
                        <div
                            className="flex-between"
                            style={{ cursor: 'pointer', padding: '12px 16px', background: 'var(--ivory)', borderRadius: 8, border: '1px solid var(--gray-light)' }}
                            onClick={() => toggleSection('month')}
                        >
                            <h3 className="card-title" style={{ margin: 0 }}>This Month</h3>
                            {expandedSections.month ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                        {expandedSections.month && (
                            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                                <StatCard label="Income" value={summary.monthly_income || 0} colorClass="bg-maroon" icon={TrendingUp} />
                                <StatCard label="Expenses" value={summary.monthly_expense || 0} colorClass="bg-red" icon={TrendingDown} />
                                <StatCard label="Profit" value={summary.monthly_profit || 0} colorClass="bg-green" icon={DollarSign} />
                            </div>
                        )}
                    </div>

                    {/* This Year Section */}
                    <div style={{ marginBottom: 16 }}>
                        <div
                            className="flex-between"
                            style={{ cursor: 'pointer', padding: '12px 16px', background: 'var(--ivory)', borderRadius: 8, border: '1px solid var(--gray-light)' }}
                            onClick={() => toggleSection('year')}
                        >
                            <h3 className="card-title" style={{ margin: 0 }}>This Year</h3>
                            {expandedSections.year ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                        {expandedSections.year && (
                            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                                <StatCard label="Income" value={summary.yearly_income || 0} colorClass="bg-maroon" icon={TrendingUp} />
                                <StatCard label="Expenses" value={summary.yearly_expense || 0} colorClass="bg-red" icon={TrendingDown} />
                                <StatCard label="Profit" value={summary.yearly_profit || 0} colorClass="bg-green" icon={DollarSign} />
                            </div>
                        )}
                    </div>

                    {/* All Time Section */}
                    <div style={{ marginBottom: 16 }}>
                        <div
                            className="flex-between"
                            style={{ cursor: 'pointer', padding: '12px 16px', background: 'var(--ivory)', borderRadius: 8, border: '1px solid var(--gray-light)' }}
                            onClick={() => toggleSection('allTime')}
                        >
                            <h3 className="card-title" style={{ margin: 0 }}>All Time</h3>
                            {expandedSections.allTime ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </div>
                        {expandedSections.allTime && (
                            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                                <StatCard label="Total Income" value={summary.total_income || 0} colorClass="bg-maroon" icon={TrendingUp} />
                                <StatCard label="Total Expenses" value={summary.total_expense || 0} colorClass="bg-red" icon={TrendingDown} />
                                <StatCard label="Net Profit" value={summary.net_profit || 0} colorClass="bg-green" icon={DollarSign} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid-2 mb-24">
                    <div className="card">
                        <div className="card-header"><h3 className="card-title flex gap-8"><Star size={18} color="var(--gold)" /> Top Services (by Revenue)</h3></div>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead><tr><th>Service</th><th>Orders</th><th>Revenue</th></tr></thead>
                                <tbody>
                                    {topServices.map((t, i) => (
                                        <tr key={i}>
                                            <td><strong>{t.service_type}</strong></td>
                                            <td>{t.count}</td>
                                            <td style={{ color: '#2E7D32', fontWeight: 600 }}>₹{parseFloat(t.revenue).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {topServices.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center' }}>No data</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3 className="card-title flex gap-8"><Award size={18} color="var(--gold)" /> Top Customers</h3></div>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead><tr><th>Customer</th><th>Orders</th><th>Spent</th></tr></thead>
                                <tbody>
                                    {topCustomers.map(c => (
                                        <tr key={c.id}>
                                            <td><strong>{c.name}</strong><br /><span style={{ fontSize: 11, color: 'var(--gray)' }}>{c.phone_number}</span></td>
                                            <td>{c.order_count}</td>
                                            <td style={{ color: '#2E7D32', fontWeight: 600 }}>₹{parseFloat(c.total_spent).toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {topCustomers.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center' }}>No data</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="grid-2">
                    {/* Add Expense Form */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Add Expense</h3></div>
                        <div className="card-body">
                            <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <label className="form-label">Date</label>
                                    <input type="date" className="form-input" required
                                        value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Category</label>
                                    <select className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Amount (₹)</label>
                                    <input type="number" step="0.01" className="form-input" required placeholder="0.00"
                                        value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">Description (Optional)</label>
                                    <input type="text" className="form-input" placeholder="e.g., 5m red silk fabric"
                                        value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
                                    <Plus size={16} /> Record Expense
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Expense History List */}
                    <div className="card">
                        <div className="card-header"><h3 className="card-title">Recent Expenses</h3></div>
                        <div className="card-body" style={{ padding: 0 }}>
                            {loading ? <div className="spinner" style={{ margin: 20 }} /> : (
                                <div className="table-container" style={{ border: 'none', maxHeight: 400, overflowY: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Category</th>
                                                <th>Amount</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {expenses.length === 0 ? (
                                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: 20 }}>No expenses recorded</td></tr>
                                            ) : expenses.map(e => (
                                                <tr key={e.type === 'stitching' ? `s_${e.id}` : `e_${e.id}`}>
                                                    <td style={{ fontSize: 13 }}>{new Date(e.date).toLocaleDateString('en-IN')}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{e.category || 'Expense'}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--gray)' }}>{e.description}</div>
                                                    </td>
                                                    <td style={{ color: '#d32f2f', fontWeight: 600 }}>₹{parseFloat(e.amount).toLocaleString('en-IN')}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {e.type !== 'stitching' && (
                                                            <button type="button" className="btn btn-ghost" style={{ color: 'var(--gray)' }}
                                                                onClick={() => handleDelete(e.id)}>
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .bg-maroon { background: var(--maroon); border: none; }
                .bg-red { background: #d32f2f; border: none; }
                .bg-green { background: #2e7d32; border: none; }
            `}</style>
        </div>
    );
}
