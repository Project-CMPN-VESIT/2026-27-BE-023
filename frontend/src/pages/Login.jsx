import React, { useState } from 'react';
import axios from 'axios';
import { Hexagon, Sparkle, ShieldCheck, User, Lock, Sun, Moon } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Login = ({ onLoginSuccess, theme, onToggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e, customUser = null, customPass = null) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    const loginUser = customUser || username;
    const loginPass = customPass || password;

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username: loginUser,
        password: loginPass
      });

      // Save token and profile to local storage
      localStorage.setItem('inventai_token', res.data.token);
      localStorage.setItem('inventai_user', JSON.stringify(res.data.user));

      onLoginSuccess(res.data.user);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role) => {
    let user = 'admin';
    if (role === 'staff') user = 'staff';
    if (role === 'manager') user = 'manager';
    handleLogin(null, user, 'password123');
  };

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 50%, var(--bg-surface) 0%, var(--bg-app) 100%)',
      fontFamily: 'var(--font-family)',
      color: 'var(--text-main)',
      padding: '24px',
      position: 'relative',
      transition: 'var(--transition)'
    }}>
      {/* Floating Theme Toggle */}
      {onToggleTheme && (
        <button 
          className="icon-btn" 
          onClick={onToggleTheme} 
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)'
          }}
          type="button"
        >
          {theme === 'light' ? <Moon size={22} /> : <Sun size={22} style={{ color: 'var(--warning)' }} />}
        </button>
      )}

      <div className="card glass-card" style={{
        width: '450px',
        padding: '40px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        transition: 'var(--transition)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'var(--primary-gradient)', fontSize: '32px', marginBottom: '16px', boxShadow: 'var(--shadow-glow)' }}>
            <Hexagon weight="fill" color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Welcome to Invent<span className="text-gradient">AI</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Enterprise Smart Inventory & Restock Portal</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--danger-light)',
            border: '1px solid var(--danger)',
            color: 'var(--danger-text)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '20px',
            fontWeight: 600
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={(e) => handleLogin(e)}>
          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--text-muted)' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Enter mock username" 
                required 
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{ paddingLeft: '48px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label" style={{ color: 'var(--text-muted)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="password" 
                className="form-input" 
                placeholder="Enter password" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '48px' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '14px', borderRadius: '12px', width: '100%' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        {/* Quick Seeder for B2B Testing */}
        <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            <ShieldCheck size={18} className="text-primary" />
            <span>Developer Sandbox Quick-Login</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <button className="btn btn-outline" type="button" onClick={() => handleQuickLogin('admin')} style={{ padding: '8px 4px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              👑 Admin
            </button>
            <button className="btn btn-outline" type="button" onClick={() => handleQuickLogin('staff')} style={{ padding: '8px 4px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              🏷️ Staff
            </button>
            <button className="btn btn-outline" type="button" onClick={() => handleQuickLogin('manager')} style={{ padding: '8px 4px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              📦 Warehouse
            </button>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '12px' }}>
            Password is <code style={{ background: 'var(--border-light)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>password123</code> for manual entry.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
