import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, PlusCircle, Search, ClipboardList,
    Scissors, X, LineChart, LogOut, DollarSign, Wrench
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose, auth, setAuth }) {
    const navigate = useNavigate();
    const isAdmin = auth?.role === 'Admin';

    const navItems = [
        { to: '/',            icon: LayoutDashboard, label: 'Dashboard',       show: true },
        { to: '/new-order',   icon: PlusCircle,      label: 'New Order',       show: true },
        { to: '/search',      icon: Search,          label: 'Customer Search', show: isAdmin },
        { to: '/orders',      icon: ClipboardList,   label: 'Order History',   show: isAdmin },
        { to: '/alterations', icon: Wrench,          label: 'Alterations',     show: isAdmin },
        { to: '/analytics',   icon: LineChart,       label: 'Analytics',       show: isAdmin },
        { to: '/profits',     icon: DollarSign,      label: 'Profits',         show: isAdmin },
    ];

    const handleLogout = () => {
        localStorage.removeItem('tailor_auth');
        setAuth(null);
        navigate('/');
    };

    const initials = auth?.name
        ? auth.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
        : (isAdmin ? 'AD' : 'WK');

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Mobile Close Button */}
            <button className="sidebar-close-btn" onClick={onClose} aria-label="Close menu">
                <X size={18} />
            </button>

            {/* Logo */}
            <div className="sidebar-logo">
                <div className="logo-circle">LM</div>
                <span className="logo-name">L.M. Ladies Tailor</span>
                <span className="logo-tagline">{isAdmin ? 'Admin Portal' : 'Worker Portal'}</span>
            </div>

            {/* User pill */}
            <div style={{
                margin: '10px 16px 0',
                padding: '10px 14px',
                background: 'rgba(198,167,94,0.07)',
                borderRadius: 10,
                border: '1px solid rgba(198,167,94,0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
            }}>
                <div style={{
                    width: 30, height: 30,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(198,167,94,0.4), rgba(198,167,94,0.2))',
                    border: '1px solid rgba(198,167,94,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--gold)',
                    flexShrink: 0,
                }}>
                    {initials}
                </div>
                <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {auth?.name || (isAdmin ? 'Administrator' : 'Worker')}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(198,167,94,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {auth?.role || 'User'}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav" style={{ flex: 1 }}>
                <p className="nav-section-title">Main Menu</p>
                {navItems.filter(item => item.show).map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                        end={to === '/'}
                        onClick={onClose}
                    >
                        <Icon size={16} strokeWidth={1.75} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* Logout */}
            <div style={{ padding: '0 12px 12px' }}>
                <button
                    onClick={handleLogout}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '9px 14px',
                        background: 'rgba(211,47,47,0.08)',
                        border: '1px solid rgba(211,47,47,0.18)',
                        borderRadius: 8,
                        color: '#ef9a9a',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-inter)',
                        letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(211,47,47,0.16)';
                        e.currentTarget.style.color = '#ffcdd2';
                        e.currentTarget.style.borderColor = 'rgba(211,47,47,0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(211,47,47,0.08)';
                        e.currentTarget.style.color = '#ef9a9a';
                        e.currentTarget.style.borderColor = 'rgba(211,47,47,0.18)';
                    }}
                >
                    <LogOut size={15} />
                    Logout
                </button>
            </div>

            {/* Footer */}
            <div className="sidebar-footer">
                <Scissors size={11} style={{ display: 'inline', marginRight: 5, opacity: 0.6 }} />
                Billing System&nbsp;·&nbsp;v1.1&nbsp;·&nbsp;2026
            </div>
        </aside>
    );
}
