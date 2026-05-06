import React, { useState } from 'react';
import { Database, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import './Auth.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Auth = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    mfa_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Please fill in all required fields');
      }
      
      if (!isLogin && !formData.username) {
        throw new Error('Username is required for registration');
      }

      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const bodyPayload = isLogin 
        ? { email: formData.email, password: formData.password, mfa_code: formData.mfa_code || null }
        : { username: formData.username, email: formData.email, password: formData.password };
        
      const res = await fetch(`${API_URL.replace(/\/api$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'any'
        },
        body: JSON.stringify(bodyPayload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isLogin) {
        onLoginSuccess({ ...data.user, token: data.token });
      } else {
        // Auto-login after registration or just switch to login tab
        setIsLogin(true);
        setError('');
        // Optional: show a success message
        alert("Registration successful! Please login.");
        setFormData({ ...formData, password: '' });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative background blur elements */}
      <div className="auth-glow-blob top-blob" />
      <div className="auth-glow-blob bottom-blob" />

      <div className="auth-glass">
        <div className="auth-header">
          <div className="auth-logo">
            <Database size={28} />
            <span>ESoft S3 Console</span>
          </div>
          <div className="auth-subtitle">
            Enterprise Hybrid Cloud Storage
          </div>
        </div>

        <div className="auth-tabs">
          <div
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </div>
          <div
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </div>
        </div>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Email Address</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                placeholder="admin@esoft.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          {isLogin && (
            <div className="input-group">
              <label>MFA Code (Extra Security - Optional)</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type="text"
                  placeholder="Enter 102030 to test"
                  value={formData.mfa_code}
                  onChange={(e) => setFormData({ ...formData, mfa_code: e.target.value })}
                />
              </div>
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <a href="#" className="forgot-password">Forgot password?</a>
              </div>
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? (
              <span className="flex-center">Processing <span className="dot-flashing" /></span>
            ) : (
              <span className="flex-center">
                {isLogin ? 'Access Console' : 'Create Account'}
                <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
