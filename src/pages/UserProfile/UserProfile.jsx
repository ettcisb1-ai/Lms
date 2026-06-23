import React, { useState, useEffect, useCallback } from 'react';
import { User, CheckCircle, Camera, Trash2, Eye, EyeOff, Lock, X, Loader } from 'lucide-react';
import './UserProfile.css';
import { AUTH_ENDPOINTS, API_BASE_URL } from '../../utils/api';

// ─── Validation helpers (same rules as Register form) ─────────────────────────

/** Name: required, no digits, letters/spaces/hyphens/apostrophes, min 2 chars */
const validateName = (v) => {
  const t = v.trim();
  if (!t) return 'Full name is required.';
  if (/\d/.test(t)) return 'Name must not contain numbers.';
  if (/[^a-zA-Z\s'\-]/.test(t)) return 'Name may only contain letters, spaces, hyphens, or apostrophes.';
  if (t.length < 2) return 'Name must be at least 2 characters.';
  return '';
};

/** Email: required, trimmed, local part min 3 chars, RFC-style format check */
const validateEmail = (v) => {
  const t = v.trim();
  if (!t) return 'Email address is required.';
  if ((t.match(/@/g) || []).length !== 1) return 'Email must contain exactly one "@" symbol.';
  // Local part (before @) must be at least 3 characters — e.g. abc@example.com
  const localPart = t.split('@')[0];
  if (localPart.length < 3) return 'Email local part must be at least 3 characters (e.g. abc@example.com).';
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t))
    return 'Enter a valid email address (e.g. abc@example.com).';
  return '';
};

/** Pakistani phone: 03XXXXXXXXX | +923XXXXXXXXX | 00923XXXXXXXXX */
const validatePhone = (v) => {
  const t = v.trim().replace(/[\s\-()]/g, '');
  if (!t) return 'Phone number is required.';
  if (!/^03[0-9]{9}$/.test(t) && !/^\+923[0-9]{9}$/.test(t) && !/^00923[0-9]{9}$/.test(t))
    return 'Enter a valid Pakistani phone number (e.g. 03001234567 or +923001234567).';
  return '';
};

// ─── Component ────────────────────────────────────────────────────────────────
const UserProfile = () => {
  const [userProfile, setUserProfile] = useState({
    name: '', email: '', phoneNumber: '',
    ip: '192.168.10.45', registeredIp: '192.168.10.45',
    ipLockEnabled: false, profilePicture: ''
  });

  // Form values
  const [fields, setFields] = useState({
    name: '', email: '', phoneNumber: ''
  });

  // Per-field errors
  const [errors, setErrors] = useState({
    name: '', email: '', phoneNumber: ''
  });

  // Track which fields have been touched (to delay showing errors)
  const [touched, setTouched] = useState({
    name: false, email: false, phoneNumber: false
  });

  const [isSaving, setIsSaving]         = useState(false);
  const [showToast, setShowToast]       = useState(false);
  const [submitError, setSubmitError]   = useState('');

  // Password Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFields, setModalFields] = useState({
    currentPassword: '', newPassword: ''
  });
  const [modalErrors, setModalErrors] = useState({
    currentPassword: '', newPassword: ''
  });
  const [modalTouched, setModalTouched] = useState({
    currentPassword: false, newPassword: false
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Load saved profile on mount
  useEffect(() => {
    const saved = localStorage.getItem('lms_user_profile');
    if (saved) {
      const p = JSON.parse(saved);
      setUserProfile(p);
      setFields({
        name:        p.name        || '',
        email:       p.email       || '',
        phoneNumber: p.phoneNumber || '',
      });
    }
  }, []);

  // ── Run validation for a single field ─────────────────────────────────────
  const runValidation = useCallback((name, value) => {
    switch (name) {
      case 'name':        return validateName(value);
      case 'email':       return validateEmail(value);
      case 'phoneNumber': return validatePhone(value);
      default:            return '';
    }
  }, []);

  // ── Run modal validation ──────────────────────────────────────────────────
  const runModalValidation = useCallback((name, value) => {
    switch (name) {
      case 'currentPassword':
        if (!value) return 'Current password is required.';
        return '';
      case 'newPassword':
        if (!value) return 'New password is required.';
        if (value.length < 6) return 'New password must be at least 6 characters.';
        return '';
      default:
        return '';
    }
  }, []);

  // ── Handle input changes with real-time blocking & validation ─────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Block digits in name field
    if (name === 'name' && /\d/.test(value)) return;

    // Phone: allow only digits and a leading +
    if (name === 'phoneNumber') {
      const clean = value.startsWith('+')
        ? '+' + value.slice(1).replace(/\D/g, '')
        : value.replace(/\D/g, '');
      setFields(prev => ({ ...prev, phoneNumber: clean }));
      if (touched.phoneNumber) {
        setErrors(prev => ({ ...prev, phoneNumber: runValidation('phoneNumber', clean) }));
      }
      return;
    }

    setFields(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: runValidation(name, value) }));
    }
  };

  // ── Handle modal input changes ────────────────────────────────────────────
  const handleModalChange = (e) => {
    const { name, value } = e.target;
    setModalFields(prev => ({ ...prev, [name]: value }));
    if (modalTouched[name]) {
      setModalErrors(prev => ({ ...prev, [name]: runModalValidation(name, value) }));
    }
  };

  // ── Handle modal blur ─────────────────────────────────────────────────────
  const handleModalBlur = (e) => {
    const { name, value } = e.target;
    setModalTouched(prev => ({ ...prev, [name]: true }));
    setModalErrors(prev => ({ ...prev, [name]: runModalValidation(name, value) }));
  };

  // ── Mark touched and validate on blur ─────────────────────────────────────
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: runValidation(name, value) }));
  };

  // ── Validate all fields before submit ─────────────────────────────────────
  const validateAll = () => {
    const newErrors = {
      name:        validateName(fields.name),
      email:       validateEmail(fields.email),
      phoneNumber: validatePhone(fields.phoneNumber),
    };
    setErrors(newErrors);
    setTouched({ name: true, email: true, phoneNumber: true });
    return Object.values(newErrors).every(e => e === '');
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateAll()) return;

    setIsSaving(true);
    const token = localStorage.getItem('lms_token');
    try {
      const body = {
        name:        fields.name.trim(),
        email:       fields.email.trim(),
        phoneNumber: fields.phoneNumber.trim(),
      };

      const response = await fetch(AUTH_ENDPOINTS.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to update profile.');

      if (result.success) {
        localStorage.setItem('lms_user_profile', JSON.stringify(result.data));
        setUserProfile(result.data);
        setTouched({ name: false, email: false, phoneNumber: false });
        window.dispatchEvent(new Event('lms_profile_sync'));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (err) {
      console.error('Profile save error:', err);
      setSubmitError(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Save password modal ───────────────────────────────────────────────────
  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    const currentErr = runModalValidation('currentPassword', modalFields.currentPassword);
    const newErr = runModalValidation('newPassword', modalFields.newPassword);

    setModalErrors({
      currentPassword: currentErr,
      newPassword: newErr
    });
    setModalTouched({
      currentPassword: true,
      newPassword: true
    });

    if (currentErr || newErr) return;

    setIsPasswordSaving(true);
    const token = localStorage.getItem('lms_token');
    try {
      const body = {
        password: modalFields.newPassword,
        currentPassword: modalFields.currentPassword
      };

      const response = await fetch(AUTH_ENDPOINTS.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to update password.');

      if (result.success) {
        setPasswordSuccess(true);
        setModalFields({ currentPassword: '', newPassword: '' });
        setModalTouched({ currentPassword: false, newPassword: false });
        setTimeout(() => {
          setIsModalOpen(false);
          setPasswordSuccess(false);
        }, 1500);
      }
    } catch (err) {
      console.error('Password update error:', err);
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  // ── Avatar handlers ───────────────────────────────────────────────────────
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Avatar image size must be under 5MB.'); return; }
    const token = localStorage.getItem('lms_token');
    const fd = new FormData();
    fd.append('file', file);
    try {
      setIsSaving(true);
      const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadResult.message || 'Upload failed.');
      if (uploadResult.success) {
        const updateRes = await fetch(AUTH_ENDPOINTS.PROFILE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ profilePicture: uploadResult.url }),
        });
        const updateResult = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateResult.message || 'Failed to save photo.');
        if (updateResult.success) {
          localStorage.setItem('lms_user_profile', JSON.stringify(updateResult.data));
          setUserProfile(updateResult.data);
          window.dispatchEvent(new Event('lms_profile_sync'));
        }
      }
    } catch (err) {
      alert(err.message || 'Failed to upload avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    const token = localStorage.getItem('lms_token');
    try {
      setIsSaving(true);
      const response = await fetch(AUTH_ENDPOINTS.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ profilePicture: '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to remove picture.');
      if (result.success) {
        localStorage.setItem('lms_user_profile', JSON.stringify(result.data));
        setUserProfile(result.data);
        window.dispatchEvent(new Event('lms_profile_sync'));
      }
    } catch (err) {
      alert(err.message || 'Failed to remove avatar.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Input class based on validation state ─────────────────────────────────
  const inputClass = (field) => {
    if (!touched[field]) return '';
    return errors[field] ? 'input-error' : 'input-valid';
  };

  const modalInputClass = (field) => {
    if (!modalTouched[field]) return '';
    return modalErrors[field] ? 'input-error' : 'input-valid';
  };

  return (
    <div className="user-profile-page">
      {/* Success toast */}
      {showToast && (
        <div className="profile-toast">
          <CheckCircle size={16} />
          <span>Profile settings updated successfully!</span>
        </div>
      )}

      <div className="profile-page-grid">
        <div className="profile-form-column">
          <div className="profile-card">

            {/* Header */}
            <div className="profile-card-header">
              <User size={18} className="icon-orange" />
              <h3>Personal Profile Details</h3>
            </div>
            <p className="card-desc">Update your registration details and academic profile name.</p>

            {/* Avatar row */}
            <div className="avatar-uploader-container">
              <div className="avatar-preview-wrapper">
                {userProfile.profilePicture ? (
                  <img src={userProfile.profilePicture} alt="Profile" className="avatar-preview-img" />
                ) : (
                  <div className="avatar-fallback-initials">
                    {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <label htmlFor="avatar-file-input" className="avatar-upload-overlay" title="Upload New Photo">
                  <Camera size={16} />
                  <input
                    type="file"
                    id="avatar-file-input"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="avatar-uploader-meta">
                <span className="avatar-name">{userProfile.name || 'Student'}</span>
                <span className="avatar-hint">Click avatar to change · Max 5MB</span>
                {userProfile.profilePicture && (
                  <button type="button" className="btn-remove-avatar" onClick={handleRemoveAvatar}>
                    <Trash2 size={12} /> Remove Photo
                  </button>
                )}
              </div>
            </div>

            {/* Server-side error */}
            {submitError && (
              <div className="profile-submit-error">{submitError}</div>
            )}

            {/* Form */}
            <form className="profile-form" onSubmit={handleProfileSave} noValidate>

              {/* Full Name */}
              <div className="form-group">
                <label htmlFor="field-name">Full Student Name</label>
                <input
                  id="field-name"
                  type="text"
                  name="name"
                  value={fields.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter your full name"
                  className={inputClass('name')}
                  required
                  autoComplete="name"
                />
                {touched.name && errors.name && (
                  <span className="profile-field-error">{errors.name}</span>
                )}
              </div>

              {/* Email */}
              <div className="form-group">
                <label htmlFor="field-email">Email Address</label>
                <input
                  id="field-email"
                  type="email"
                  name="email"
                  value={fields.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter your email"
                  className={inputClass('email')}
                  required
                  autoComplete="email"
                />
                {touched.email && errors.email && (
                  <span className="profile-field-error">{errors.email}</span>
                )}
              </div>

              {/* Phone */}
              <div className="form-group">
                <label htmlFor="field-phone">Phone Number</label>
                <input
                  id="field-phone"
                  type="tel"
                  name="phoneNumber"
                  value={fields.phoneNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. 03001234567 or +923001234567"
                  className={inputClass('phoneNumber')}
                  required
                  autoComplete="tel"
                />
                {touched.phoneNumber && errors.phoneNumber && (
                  <span className="profile-field-error">{errors.phoneNumber}</span>
                )}
              </div>

              {/* Change Password Link */}
              <div className="form-group" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-trigger-password"
                  onClick={() => {
                    setModalFields({ currentPassword: '', newPassword: '' });
                    setModalErrors({ currentPassword: '', newPassword: '' });
                    setModalTouched({ currentPassword: false, newPassword: false });
                    setPasswordError('');
                    setPasswordSuccess(false);
                    setIsModalOpen(true);
                  }}
                >
                  <Lock size={14} />
                  <span>Update Password</span>
                </button>
              </div>

              <button
                type="submit"
                className={`btn-save-profile${isSaving ? ' loading' : ''}`}
                disabled={isSaving}
              >
                {isSaving ? <><Loader size={16} className="spin-icon" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />Saving Updates...</> : 'Save Settings'}
              </button>

            </form>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="profile-modal-overlay" onClick={isPasswordSaving ? undefined : () => setIsModalOpen(false)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            
            <div className="profile-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} style={{ color: 'var(--primary-color)' }} />
                Change Account Password
              </h3>
              <button className="btn-close-modal" onClick={() => setIsModalOpen(false)} disabled={isPasswordSaving}>
                <X size={18} />
              </button>
            </div>

            {passwordError && (
              <div className="profile-submit-error" style={{ margin: 0 }}>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="profile-toast" style={{ position: 'relative', top: 0, right: 0, margin: 0, justifyContent: 'center' }}>
                <CheckCircle size={16} />
                <span>Password changed successfully!</span>
              </div>
            )}

            <form className="profile-form" onSubmit={handlePasswordSave} noValidate>
              
              {/* Current Password */}
              <div className="form-group">
                <label htmlFor="field-current-password">Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="field-current-password"
                    type={showCurrentPass ? 'text' : 'password'}
                    name="currentPassword"
                    value={modalFields.currentPassword}
                    onChange={handleModalChange}
                    onBlur={handleModalBlur}
                    placeholder="Enter current password"
                    className={modalInputClass('currentPassword')}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="btn-toggle-password"
                    onClick={() => setShowCurrentPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {modalTouched.currentPassword && modalErrors.currentPassword && (
                  <span className="profile-field-error">{modalErrors.currentPassword}</span>
                )}
              </div>

              {/* New Password */}
              <div className="form-group">
                <label htmlFor="field-new-password">New Password</label>
                <div className="password-input-wrapper">
                  <input
                    id="field-new-password"
                    type={showNewPass ? 'text' : 'password'}
                    name="newPassword"
                    value={modalFields.newPassword}
                    onChange={handleModalChange}
                    onBlur={handleModalBlur}
                    placeholder="Enter new password (min 6 characters)"
                    className={modalInputClass('newPassword')}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn-toggle-password"
                    onClick={() => setShowNewPass(p => !p)}
                    tabIndex={-1}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {modalTouched.newPassword && modalErrors.newPassword && (
                  <span className="profile-field-error">{modalErrors.newPassword}</span>
                )}
              </div>

              <div className="profile-modal-footer">
                <button
                  type="button"
                  className="btn-cancel-modal"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPasswordSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`btn-save-profile${isPasswordSaving ? ' loading' : ''}`}
                  style={{ width: 'auto', padding: '10px 24px', marginTop: 0 }}
                  disabled={isPasswordSaving || passwordSuccess}
                >
                  {isPasswordSaving ? <><Loader size={16} className="spin-icon" style={{ display: 'inline-block', marginRight: '8px', verticalAlign: 'middle' }} />Updating...</> : 'Update Password'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfile;