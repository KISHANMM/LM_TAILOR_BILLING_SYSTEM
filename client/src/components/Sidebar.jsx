import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, PlusCircle, Search, ClipboardList,
    Scissors, X, LineChart, LogOut, DollarSign
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose, auth, setAuth }) {
    const navigate = useNavigate();
    const isAdmin = auth?.role === 'Admin';

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', show: true },
        { to: '/new-order', icon: PlusCircle, label: 'New Order', show: true },
        { to: '/search', icon: Search, label: 'Customer Search', show: isAdmin },
        { to: '/orders', icon: ClipboardList, label: 'Order History', show: isAdmin },
        { to: '/analytics', icon: LineChart, label: 'Analytics', show: isAdmin },
        { to: '/profits', icon: DollarSign, label: 'Profits', show: isAdmin },
    ];

    const handleLogout = () => {
        localStorage.removeItem('tailor_auth');
        setAuth(null);
        navigate('/');
    };

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* Mobile Close Button */}
            <button className="sidebar-close-btn" onClick={onClose}>
                <X size={20} />
            </button>
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="logo-circle">LM</div>
                <span className="logo-name">L.M. Ladies Tailor</span>
                <span className="logo-tagline">{isAdmin ? 'Admin Portal' : 'Worker Portal'}</span>
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
                        onClick={onClose} // Close sidebar on mobile after clicking a link
                    >
                        <Icon size={17} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            <div style={{ padding: '0 16px 16px' }}>
                <button
                    onClick={handleLogout}
                    className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', color: '#D32F2F', padding: '10px 16px' }}
                >
                    <LogOut size={17} style={{ marginRight: 8 }} /> Logout
                </button>
            </div>

            {/* Footer info */}
            <div className="sidebar-footer">
                <Scissors size={14} style={{ display: 'inline', marginRight: 5 }} />
                Shop Billing System
                <br />v1.0 — 2026
            </div>
        </aside>
    );
}
