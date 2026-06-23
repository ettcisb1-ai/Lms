import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_ENDPOINTS } from '../../utils/api';
import './ForgotPassword.css';

const ForgotPassword = () => {
    const navigate = useNavigate();

    // Flow steps: 'request' → 'sent' → 'reset' → 'success'
    const [step, setStep]           = useState('request');
    const [email, setEmail]         = useState('');
    const [enteredOtp, setEnteredOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState(''); // server-side this would be hidden

    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew]       = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [error, setError]       = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // ── Step 1: Verify email exists in DB, then send OTP ─────────────────────
    const handleRequestReset = async (e) => {
        e.preventDefault();
        setError('');
        const trimmedEmail = email.trim();

        if (!trimmedEmail) { setError('Please enter your email address.'); return; }

        setIsLoading(true);
        try {
            // Call the backend forgot-password endpoint.
            // The backend should: check if the email exists, generate & email the OTP.
            // Expected success response: { success: true, message: '...' }
            // Expected failure (not found): { success: false, message: 'Email not found' } or 404
            const response = await fetch(AUTH_ENDPOINTS.FORGOT_PASSWORD, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmedEmail }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                // Covers both 404 (email not registered) and other server errors
                throw new Error(result.message || 'No account found with this email address.');
            }

            // OTP was sent by the server — move to verification step
            setStep('sent');
        } catch (err) {
            setError(err.message || 'Unable to send reset code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Step 2: Verify the OTP the user entered ───────────────────────────────
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        if (!enteredOtp || enteredOtp.length !== 6) {
            setError('Please enter the complete 6-digit code.');
            return;
        }

        setIsLoading(true);
        try {
            // Verify OTP against the backend
            const response = await fetch(`${AUTH_ENDPOINTS.FORGOT_PASSWORD}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: enteredOtp }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Invalid or expired code. Please try again.');
            }

            setStep('reset');
        } catch (err) {
            setError(err.message || 'Invalid code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Step 3: Set new password ──────────────────────────────────────────────
    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) { setError('Please fill in both fields.'); return; }
        if (newPassword.length < 6)           { setError('Password must be at least 6 characters.'); return; }
        if (newPassword !== confirmPassword)  { setError('Passwords do not match.'); return; }

        setIsLoading(true);
        try {
            const response = await fetch(`${AUTH_ENDPOINTS.FORGOT_PASSWORD}/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email:       email.trim(),
                    otp:         enteredOtp,
                    newPassword: newPassword,
                }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to reset password. Please try again.');
            }

            setStep('success');
        } catch (err) {
            setError(err.message || 'Failed to reset password. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card fp-card">
                <div className="login-image-pane">
                    <img
                        src="https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&w=800&q=80"
                        alt="Security"
                        className="login-image"
                    />
                </div>

                <div className="login-form-pane">
                    <h1 className="login-logo">LMS Portal</h1>

                    <div className="login-form-wrapper">

                        {/* ── Step 1: Enter registered email ── */}
                        {step === 'request' && (
                            <>
                                <h2 className="login-title">Forgot Password</h2>
                                <p className="login-subtitle">
                                    Enter your registered email and we'll send you a reset code.
                                </p>
                                {error && <div className="register-error">{error}</div>}
                                <form onSubmit={handleRequestReset} className="login-form">
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
                                    <button type="submit" className="login-submit-btn" disabled={isLoading}>
                                        {isLoading ? 'Checking email…' : 'Send Reset Code'}
                                    </button>
                                </form>
                                <p className="register-login-link">
                                    Remembered it?{' '}
                                    <button className="link-btn" onClick={() => navigate('/login')}>
                                        Back to login
                                    </button>
                                </p>
                            </>
                        )}

                        {/* ── Step 2: Enter OTP ── */}
                        {step === 'sent' && (
                            <>
                                <h2 className="login-title">Check Your Email</h2>
                                <p className="login-subtitle">
                                    A 6-digit code was sent to <strong>{email}</strong>. Enter it below.
                                </p>
                                {error && <div className="register-error">{error}</div>}
                                <form onSubmit={handleVerifyOtp} className="login-form">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="Enter 6-digit code"
                                        className="login-input fp-otp-input"
                                        value={enteredOtp}
                                        onChange={(e) =>
                                            setEnteredOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                                        }
                                        maxLength={6}
                                        required
                                        disabled={isLoading}
                                    />
                                    <button type="submit" className="login-submit-btn" disabled={isLoading}>
                                        {isLoading ? 'Verifying…' : 'Verify Code'}
                                    </button>
                                </form>
                                <p className="register-login-link">
                                    <button
                                        className="link-btn"
                                        onClick={() => { setStep('request'); setError(''); setEnteredOtp(''); }}
                                    >
                                        Try a different email
                                    </button>
                                </p>
                            </>
                        )}

                        {/* ── Step 3: Set new password ── */}
                        {step === 'reset' && (
                            <>
                                <h2 className="login-title">Set New Password</h2>
                                <p className="login-subtitle">Choose a strong new password for your account.</p>
                                {error && <div className="register-error">{error}</div>}
                                <form onSubmit={handleResetPassword} className="login-form">
                                    {/* New password */}
                                    <div className="login-pw-wrapper">
                                        <input
                                            type={showNew ? 'text' : 'password'}
                                            placeholder="New password"
                                            className="login-input"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="login-eye-btn"
                                            onClick={() => setShowNew(p => !p)}
                                            tabIndex={-1}
                                            aria-label={showNew ? 'Hide password' : 'Show password'}
                                        >
                                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    {/* Confirm password */}
                                    <div className="login-pw-wrapper">
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            placeholder="Confirm new password"
                                            className="login-input"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            autoComplete="new-password"
                                        />
                                        <button
                                            type="button"
                                            className="login-eye-btn"
                                            onClick={() => setShowConfirm(p => !p)}
                                            tabIndex={-1}
                                            aria-label={showConfirm ? 'Hide password' : 'Show password'}
                                        >
                                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    <button type="submit" className="login-submit-btn" disabled={isLoading}>
                                        {isLoading ? 'Saving…' : 'Reset Password'}
                                    </button>
                                </form>
                            </>
                        )}

                        {/* ── Step 4: Success ── */}
                        {step === 'success' && (
                            <div className="fp-success">
                                <div className="fp-success-icon">✓</div>
                                <h2 className="login-title">Password Reset!</h2>
                                <p className="login-subtitle">
                                    Your password has been updated successfully. You can now log in with your new password.
                                </p>
                                <button className="login-submit-btn" onClick={() => navigate('/login')}>
                                    Back to Login
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
            <div className="login-background-pattern" />
        </div>
    );
};

export default ForgotPassword;