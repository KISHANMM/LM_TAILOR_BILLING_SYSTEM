import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Lock, User, LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { clearAllOfflineCaches } from '../utils/offlineStore';

export default function Login({ setAuth }) {
    const navigate = useNavigate();
    const [role, setRole] = useState('Admin'); // 'Admin' or 'Worker'
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        clearAllOfflineCaches();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/auth/login', { role, password });
            const { token, user, message } = res.data;

            localStorage.setItem('tailor_token', token);
            localStorage.setItem('tailor_auth', JSON.stringify(user));
            setAuth(user);
            toast.success(message || 'Login successful!');
            navigate('/');
        } catch (err) {
            console.error('Login error:', err);
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', background: 'var(--ivory)', padding: '20px'
        }}>
            <div className="card" style={{ maxWidth: 400, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', border: 'none' }}>
                <div style={{ textAlign: 'center', padding: '32px 24px 16px' }}>
                    <div className="logo-circle" style={{ margin: '0 auto 16px', width: 64, height: 64, fontSize: 24 }}>LM</div>
                    <h2 style={{ fontFamily: '"Playfair Display", serif', color: 'var(--maroon-dark)', margin: 0, fontSize: 24 }}>L.M. Ladies Tailor</h2>
                    <p style={{ color: 'var(--gold)', margin: '8px 0 0', fontSize: 14 }}>Billing & Management System</p>
                </div>

                <div className="card-body" style={{ padding: '0 32px 32px' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#f5f5f5', padding: 4, borderRadius: 8 }}>
                        <button
                            type="button"
                            className={`btn btn-sm ${role === 'Admin' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setRole('Admin')}
                        >
                            Admin
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${role === 'Worker' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1, justifyContent: 'center' }}
                            onClick={() => setRole('Worker')}
                        >
                            Worker
                        </button>
                    </div>

                    <form onSubmit={handleLogin}>
                        {role === 'Admin' ? (
                            <div className="form-group mb-24">
                                <label className="form-label">Admin Password</label>
                                <div className="input-prefix" style={{ display: 'flex', alignItems: 'center' }}>
                                    <span className="prefix-symbol"><Lock size={16} /></span>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="form-input"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        style={{ border: 'none', background: 'transparent', flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--gray)',
                                            paddingRight: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="form-group mb-24">
                                <label className="form-label">Worker Name</label>
                                <div className="input-prefix" style={{ background: '#f9f9f9' }}>
                                    <span className="prefix-symbol"><User size={16} /></span>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value="Praveen"
                                        disabled
                                        style={{ border: 'none', background: 'transparent', color: 'var(--gray)' }}
                                    />
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--gray)', marginTop: 8 }}>No password required for worker access.</p>
                            </div>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                            <LogIn size={18} style={{ marginRight: 8 }} /> {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
