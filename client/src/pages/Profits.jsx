import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Menu, Eye, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Profits({ onMenuClick }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = () => {
        api.get('/orders')
            .then(res => setOrders(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    const handleSaveExpense = async (orderId) => {
        try {
            await api.put(`/orders/${orderId}/expense`, { stitching_expense: parseFloat(editValue) || 0 });
            toast.success('Expense updated');
            setEditingId(null);
            fetchOrders();
        } catch (err) {
            toast.error('Failed to update expense');
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
                        <div className="topbar-title">Profits</div>
                        <div className="topbar-subtitle">Loading data...</div>
                    </div>
                </div>
            </div>
            <div className="page-container"><div className="spinner" /></div>
        </div>
    );

    // Calculate total sums for the footer
    const totals = orders.reduce((acc, o) => {
        const totalAmount = parseFloat(o.total_amount) || 0;
        const stitchingEx = parseFloat(o.stitching_expense) || 0;
        acc.totalPrice += totalAmount;
        acc.totalExpense += stitchingEx;
        acc.totalProfit += (totalAmount - stitchingEx);
        return acc;
    }, { totalPrice: 0, totalExpense: 0, totalProfit: 0 });

    return (
        <div>
            <div className="topbar flex-between">
                <div className="flex">
                    <button className="mobile-menu-btn" onClick={onMenuClick}>
                        <Menu size={22} />
                    </button>
                    <div>
                        <div className="topbar-title">Profits Details</div>
                        <div className="topbar-subtitle">Breakdown of orders vs expenses</div>
                    </div>
                </div>
            </div>

            <div className="page-container">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title flex gap-8"><DollarSign size={18} color="var(--gold)" /> Order Profit Table</h3>
                    </div>
                    <>
                        <div className="table-container hide-on-mobile" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Customer Name</th>
                                        <th>Total Price (₹)</th>
                                        <th>Stitching Expense (₹)</th>
                                        <th>Total Profit (₹)</th>
                                        <th>Bill</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--gray)' }}>No orders found</td>
                                        </tr>
                                    ) : (
                                        orders.map(o => {
                                            const totalPrice = parseFloat(o.total_amount) || 0;
                                            const expense = parseFloat(o.stitching_expense) || 0;
                                            const profit = totalPrice - expense;

                                            return (
                                                <tr key={o.order_id}>
                                                    <td><span style={{ fontWeight: 600, color: 'var(--maroon)' }}>#{String(o.order_id).padStart(4, '0')}</span></td>
                                                    <td>
                                                        <Link to={`/customer/${o.customer_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                            <strong>{o.customer_name}</strong>
                                                        </Link>
                                                    </td>
                                                    <td>₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                    <td>
                                                        {editingId === o.order_id ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <div className="input-prefix" style={{ width: 100, padding: 0 }}>
                                                                    <span className="prefix-symbol" style={{ padding: '4px 8px' }}>₹</span>
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        value={editValue}
                                                                        onChange={e => setEditValue(e.target.value)}
                                                                        style={{ padding: '4px', border: 'none', height: 30 }}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#2E7D32' }} onClick={() => handleSaveExpense(o.order_id)}>
                                                                    <Check size={16} />
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#D32F2F' }} onClick={() => setEditingId(null)}>
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E65100' }}>
                                                                <span>₹{expense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                                <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => {
                                                                    setEditingId(o.order_id);
                                                                    setEditValue(expense);
                                                                }}>
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ color: profit >= 0 ? '#2E7D32' : '#D32F2F', fontWeight: 600 }}>
                                                        ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td>
                                                        <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                            <Eye size={12} /> View
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {orders.length > 0 && (
                                    <tfoot>
                                        <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                                            <td colSpan={2} style={{ textAlign: 'right' }}>Total:</td>
                                            <td>₹{totals.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ color: '#E65100' }}>₹{totals.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td style={{ color: totals.totalProfit >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                                ₹{totals.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="mobile-cards show-on-mobile" style={{ padding: '16px' }}>
                            {orders.length > 0 && (
                                <div className="kpi-summary-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                    <div className="kpi-card" style={{ background: 'var(--ivory-dark)', padding: '12px', borderRadius: 8, border: '1px solid var(--gray-light)' }}>
                                        <span style={{ fontSize: 11, color: 'var(--gray)' }}>Total Price</span>
                                        <strong style={{ display: 'block', fontSize: 14, color: 'var(--maroon)' }}>₹{totals.totalPrice.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="kpi-card" style={{ background: 'var(--ivory-dark)', padding: '12px', borderRadius: 8, border: '1px solid var(--gray-light)' }}>
                                        <span style={{ fontSize: 11, color: 'var(--gray)' }}>Total Expenses</span>
                                        <strong style={{ display: 'block', fontSize: 14, color: '#E65100' }}>₹{totals.totalExpense.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div className="kpi-card" style={{ background: 'var(--ivory-dark)', padding: '12px', borderRadius: 8, border: '1px solid var(--gray-light)', gridColumn: 'span 2', textAlign: 'center' }}>
                                        <span style={{ fontSize: 11, color: 'var(--gray)' }}>Net Profit</span>
                                        <strong style={{ display: 'block', fontSize: 16, color: totals.totalProfit >= 0 ? '#2E7D32' : '#D32F2F' }}>
                                            ₹{totals.totalProfit.toLocaleString('en-IN')}
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {orders.length === 0 ? (
                                <div className="empty-state">No orders found</div>
                            ) : (
                                orders.map(o => {
                                    const totalPrice = parseFloat(o.total_amount) || 0;
                                    const expense = parseFloat(o.stitching_expense) || 0;
                                    const profit = totalPrice - expense;

                                    return (
                                        <div className="order-card" key={o.order_id}>
                                            <div className="order-card-header">
                                                <div className="order-card-id" style={{ color: 'var(--maroon)' }}>
                                                    #{String(o.order_id).padStart(4, '0')}
                                                </div>
                                                <Link to={`/bill/${o.order_id}`} className="btn btn-sm btn-outline">
                                                    <Eye size={12} /> View Bill
                                                </Link>
                                            </div>
                                            <div className="order-card-body">
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Customer</span>
                                                    <Link to={`/customer/${o.customer_id}`} className="order-card-value" style={{ fontWeight: 600 }}>
                                                        {o.customer_name}
                                                    </Link>
                                                </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Total Price</span>
                                                    <span className="order-card-value">₹{totalPrice.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Expense</span>
                                                    <div className="order-card-value">
                                                        {editingId === o.order_id ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                                                                <div className="input-prefix" style={{ flex: 1, padding: 0 }}>
                                                                    <span className="prefix-symbol" style={{ padding: '4px 8px' }}>₹</span>
                                                                    <input
                                                                        type="number"
                                                                        className="form-input"
                                                                        value={editValue}
                                                                        onChange={e => setEditValue(e.target.value)}
                                                                        style={{ padding: '4px', border: 'none', height: 30, width: '100%' }}
                                                                        autoFocus
                                                                    />
                                                                </div>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#2E7D32' }} onClick={() => handleSaveExpense(o.order_id)}>
                                                                    <Check size={16} />
                                                                </button>
                                                                <button className="btn btn-sm btn-ghost" style={{ padding: 4, color: '#D32F2F' }} onClick={() => setEditingId(null)}>
                                                                    <X size={16} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E65100' }}>
                                                                <span>₹{expense.toLocaleString('en-IN')}</span>
                                                                <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => {
                                                                    setEditingId(o.order_id);
                                                                    setEditValue(expense);
                                                                }}>
                                                                    <Edit2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="order-card-item">
                                                    <span className="order-card-label">Net Profit</span>
                                                    <span className="order-card-value" style={{ color: profit >= 0 ? '#2E7D32' : '#D32F2F', fontWeight: 700 }}>
                                                        ₹{profit.toLocaleString('en-IN')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                </div>
            </div>
        </div>
    );
}
