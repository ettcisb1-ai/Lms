import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_ENDPOINTS, ADMIN_ENDPOINTS } from '../../utils/api';
import './Login.css';

const Login = () => {
  const [activeTab, setActiveTab]     = useState('Admin');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const navigate = useNavigate();

  // Auto-redirect if already logged in (e.g., reopened browser)
  useEffect(() => {
    const token = localStorage.getItem('lms_token');
    const role = localStorage.getItem('lms_user_role');
    if (token && role) {
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [navigate]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setError('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = activeTab === 'Admin'
        ? ADMIN_ENDPOINTS.LOGIN_ADMIN
        : AUTH_ENDPOINTS.LOGIN_USER;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Login failed. Please check your credentials.');
      }

      if (result.success) {
        const userData = result.data;
        localStorage.setItem('lms_user_role', userData.role);
        localStorage.setItem('lms_token', userData.token);

        if (userData.role === 'admin') {
          localStorage.setItem('lms_admin_profile', JSON.stringify(userData));
          navigate('/admin/dashboard');
        } else {
          localStorage.setItem('lms_user_profile', JSON.stringify(userData));
          navigate('/dashboard');
        }
      } else {
        throw new Error(result.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-image-pane">
          <img
            src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80"
            alt="Shopping cart"
            className="login-image"
          />
        </div>

        <div className="login-form-pane">
          <h1 className="login-logo">LMS Portal</h1>

          {/* Admin / User tab switcher */}
          <div className="login-tabs">
            <button
              className={`tab-btn ${activeTab === 'Admin' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('Admin')}
            >
              Admin
            </button>
            <button
              className={`tab-btn ${activeTab === 'User' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('User')}
            >
              User
            </button>
          </div>

          <div className="login-form-wrapper">
            <h2 className="login-title">{activeTab} Login</h2>
            <p className="login-subtitle">Please enter the credentials associated with your account.</p>

            {error && <div className="register-error">{error}</div>}

            <form onSubmit={handleLogin} className="login-form">
              {/* Email */}
              <input
                type="email"
                placeholder="Email address"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
              />

              {/* Password with eye toggle */}
              <div className="login-pw-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="login-form-footer">
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate('/forgot-password')}
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            {activeTab === 'User' && (
              <p className="register-login-link">
                Don't have an account?{' '}
                <button className="link-btn" onClick={() => navigate('/register')}>
                  Register
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="login-background-pattern" />
    </div>
  );
};

export default Login;