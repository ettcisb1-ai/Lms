import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AUTH_ENDPOINTS } from '../../utils/api';
import './Register.css';

// ─── Validation helpers ────────────────────────────────────────────────────────

/**
 * Name validation:
 * - Required (non-empty after trim)
 * - Must NOT contain digits or special symbols — letters, spaces, hyphens, apostrophes only
 */
const validateName = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required.';
  if (/\d/.test(trimmed)) return 'Name must not contain numbers.';
  if (/[^a-zA-Z\s'\-]/.test(trimmed)) return 'Name may only contain letters, spaces, hyphens, or apostrophes.';
  if (trimmed.length < 2) return 'Name must be at least 2 characters.';
  return '';
};

/**
 * Email validation:
 * - Required
 * - Trimmed before checking
 * - Local part (before @) must be at least 3 characters
 * - Must match standard format: local@domain.tld
 * - Rejects missing @, missing domain, multiple @, invalid chars
 */
const validateEmail = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Email address is required.';

  // Reject multiple @ symbols
  if ((trimmed.match(/@/g) || []).length !== 1) return 'Email must contain exactly one "@" symbol.';

  // Local part (before @) must be at least 3 characters
  const localPart = trimmed.split('@')[0];
  if (localPart.length < 3) return 'Email local part must be at least 3 characters (e.g. abc@example.com).';

  // RFC 5322-inspired regex: covers the vast majority of real email addresses
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return 'Enter a valid email address (e.g. abc@example.com).';

  return '';
};

/**
 * Pakistani phone number validation:
 * Accepted formats:
 *   - Local:       03XXXXXXXXX  (11 digits, starts with 03)
 *   - International: +923XXXXXXXXX  (12 digits after +, e.g. +923145632145)
 *   - Also accepts 0092XXXXXXXXX
 */
const validatePhone = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Phone number is required.';

  // Remove hyphens, spaces, parentheses for normalisation
  const cleaned = trimmed.replace(/[\s\-()]/g, '');

  // Match: 03XXXXXXXXX(X)  OR  +923XXXXXXXXX(X)  OR  00923XXXXXXXXX(X)
  const localFormat       = /^03[0-9]{9,10}$/;         // 11 or 12 digits
  const intlPlusFormat    = /^\+923[0-9]{9,10}$/;      // +923 + 9 or 10 digits
  const intlDoubleOhFormat = /^00923[0-9]{9,10}$/;     // 00923 + 9 or 10 digits

  if (!localFormat.test(cleaned) && !intlPlusFormat.test(cleaned) && !intlDoubleOhFormat.test(cleaned)) {
    return 'Enter a valid Pakistani phone number (e.g. 03001234567 or +923001234567).';
  }
  return '';
};

/**
 * Password validation:
 * - Required
 * - At least 6 characters
 */
const validatePassword = (value) => {
  if (!value) return 'Password is required.';
  if (value.length < 6) return 'Password must be at least 6 characters.';
  return '';
};

/**
 * Confirm password validation:
 * - Must match the original password
 */
const validateConfirmPassword = (value, original) => {
  if (!value) return 'Please confirm your password.';
  if (value !== original) return 'Passwords do not match.';
  return '';
};

// ─── Component ────────────────────────────────────────────────────────────────

const Register = () => {
  const navigate = useNavigate();

  // Form field values
  const [fields, setFields] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  // Per-field error messages (real-time)
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  // Whether each field has been touched (don't show errors before first interaction)
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phoneNumber: false,
    password: false,
    confirmPassword: false,
  });

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);

  // Global submission state
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading]     = useState(false);

  // ── Per-field validation runner ───────────────────────────────────────────
  const runValidation = useCallback((name, value, allFields) => {
    switch (name) {
      case 'name':            return validateName(value);
      case 'email':           return validateEmail(value);
      case 'phoneNumber':     return validatePhone(value);
      case 'password':        return validatePassword(value);
      case 'confirmPassword': return validateConfirmPassword(value, allFields?.password ?? fields.password);
      default:                return '';
    }
  }, [fields.password]);

  // ── Handle field change (real-time validation after first touch) ──────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Block digits in name field in real time
    if (name === 'name' && /\d/.test(value)) return;

    // Phone: allow only digits and a leading + sign (for +92... format)
    if (name === 'phoneNumber') {
      // Strip any character that is not a digit or a leading +
      const filtered = value.replace(/(?!^\+)[^\d]/g, '');
      // Prevent + appearing anywhere other than position 0
      const clean = filtered.startsWith('+')
        ? '+' + filtered.slice(1).replace(/\D/g, '')
        : filtered.replace(/\D/g, '');
      const updatedFields = { ...fields, phoneNumber: clean };
      setFields(updatedFields);
      if (touched.phoneNumber) {
        setErrors(prev => ({ ...prev, phoneNumber: runValidation('phoneNumber', clean, updatedFields) }));
      }
      return;
    }

    const updatedFields = { ...fields, [name]: value };
    setFields(updatedFields);

    // Validate in real time only after the field has been touched once
    if (touched[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: runValidation(name, value, updatedFields),
        // If password changes, revalidate confirm password too
        ...(name === 'password' && touched.confirmPassword
          ? { confirmPassword: validateConfirmPassword(updatedFields.confirmPassword, value) }
          : {}),
      }));
    }
  };

  // ── Mark field as touched and validate on blur ────────────────────────────
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: runValidation(name, value) }));
  };

  // ── Validate all fields and return true if form is clean ─────────────────
  const validateAll = () => {
    const newErrors = {
      name:            validateName(fields.name),
      email:           validateEmail(fields.email),
      phoneNumber:     validatePhone(fields.phoneNumber),
      password:        validatePassword(fields.password),
      confirmPassword: validateConfirmPassword(fields.confirmPassword, fields.password),
    };
    setErrors(newErrors);
    // Mark everything as touched so all errors become visible
    setTouched({ name: true, email: true, phoneNumber: true, password: true, confirmPassword: true });
    return Object.values(newErrors).every(e => e === '');
  };

  // ── Form submission ───────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitError('');

    // Run full validation before hitting the network
    if (!validateAll()) return;

    setIsLoading(true);
    try {
      const response = await fetch(AUTH_ENDPOINTS.REGISTER_USER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        fields.name.trim(),
          email:       fields.email.trim(),
          phoneNumber: fields.phoneNumber.trim(),
          password:    fields.password,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Registration failed.');

      if (result.success) {
        const userData = result.data;
        localStorage.setItem('lms_user_role',    userData.role);
        localStorage.setItem('lms_token',        userData.token);
        localStorage.setItem('lms_user_profile', JSON.stringify(userData));

        // Keep local fallback registry
        const existing = JSON.parse(localStorage.getItem('lms_registered_users') || '[]');
        localStorage.setItem('lms_registered_users', JSON.stringify([...existing, userData]));

        navigate('/dashboard');
      } else {
        throw new Error(result.message || 'Invalid registration response.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setSubmitError(err.message || 'Unable to connect to registration server.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Helper: determine input class based on validation state ───────────────
  const inputClass = (field) => {
    if (!touched[field]) return 'login-input';
    return errors[field] ? 'login-input input-error' : 'login-input input-valid';
  };

  return (
    <div className="login-container">
      <div className="login-card register-card">
        {/* Left image pane */}
        <div className="login-image-pane">
          <img
            src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80"
            alt="Learning"
            className="login-image"
          />
        </div>

        {/* Right form pane */}
        <div className="login-form-pane">
          <h1 className="login-logo">LMS Portal</h1>

          <div className="login-form-wrapper">
            <h2 className="login-title">Create Account</h2>
            <p className="login-subtitle">Register to start your learning journey today.</p>

            {/* Global server-side error */}
            {submitError && <div className="register-error">{submitError}</div>}

            <form onSubmit={handleRegister} className="login-form" noValidate>

              {/* ── Full Name ── */}
              <div className="field-group">
                <input
                  type="text"
                  name="name"
                  placeholder="Full name"
                  className={inputClass('name')}
                  value={fields.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="name"
                />
                {touched.name && errors.name && (
                  <span className="field-error">{errors.name}</span>
                )}
              </div>

              {/* ── Phone Number ── */}
              <div className="field-group">
                <input
                  type="tel"
                  name="phoneNumber"
                  placeholder="Phone number (e.g. 03001234567)"
                  className={inputClass('phoneNumber')}
                  value={fields.phoneNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="tel"
                />
                {touched.phoneNumber && errors.phoneNumber && (
                  <span className="field-error">{errors.phoneNumber}</span>
                )}
              </div>

              {/* ── Email ── */}
              <div className="field-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  className={inputClass('email')}
                  value={fields.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="email"
                />
                {touched.email && errors.email && (
                  <span className="field-error">{errors.email}</span>
                )}
              </div>

              {/* ── Password ── */}
              <div className="field-group">
                <div className="password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password (min 6 characters)"
                    className={inputClass('password')}
                    value={fields.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(p => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <span className="field-error">{errors.password}</span>
                )}
              </div>

              {/* ── Confirm Password ── */}
              <div className="field-group">
                <div className="password-wrapper">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm password"
                    className={inputClass('confirmPassword')}
                    value={fields.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowConfirm(p => !p)}
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {touched.confirmPassword && errors.confirmPassword && (
                  <span className="field-error">{errors.confirmPassword}</span>
                )}
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                {isLoading ? 'Creating Account…' : 'Create Account'}
              </button>
            </form>

            <p className="register-login-link">
              Already have an account?{' '}
              <button className="link-btn" onClick={() => navigate('/login')}>
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
      <div className="login-background-pattern" />
    </div>
  );
};

export default Register;