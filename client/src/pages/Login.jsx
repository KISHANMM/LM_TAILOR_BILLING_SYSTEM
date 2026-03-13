import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scissors, Lock, User, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login({ setAuth }) {
    const navigate = useNavigate();
    const [role, setRole] = useState('Admin'); // 'Admin' or 'Worker'
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();

        if (role === 'Admin') {
            if (password === 'LataMagaji') {
                const user = { role: 'Admin', name: 'Lata' };
                localStorage.setItem('tailor_auth', JSON.stringify(user));
                setAuth(user);
                toast.success('Welcome back, Admin!');
                navigate('/');
            } else {
                toast.error('Incorrect password');
            }
        } else {
            // Worker login is unrestricted for Praveen
            const user = { role: 'Worker', name: 'Praveen' };
            localStorage.setItem('tailor_auth', JSON.stringify(user));
            setAuth(user);
            toast.success('Logged in as Praveen');
            navigate('/');
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
                                <div className="input-prefix">
                                    <span className="prefix-symbol"><Lock size={16} /></span>
                                    <input
                                        type="password"
                                        className="form-input"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                        style={{ border: 'none', background: 'transparent' }}
                                    />
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

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                            <LogIn size={18} style={{ marginRight: 8 }} /> Login
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
