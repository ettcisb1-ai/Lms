import React, { useState, useEffect } from 'react';
import { Unlock, ShieldCheck, Check, Loader } from 'lucide-react';
import './Settings.css';
import { SUBSCRIPTION_ENDPOINTS } from '../../utils/api';

const Settings = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [subscriptionModeEnabled, setSubscriptionModeEnabled] = useState(true);

  const token = localStorage.getItem('lms_token');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(SUBSCRIPTION_ENDPOINTS.SETTINGS, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (result.success && result.data) {
          setSubscriptionModeEnabled(result.data.subscriptionModeEnabled ?? true);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSelect = async (paid) => {
    setSubscriptionModeEnabled(paid);
    setIsSaving(true);
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.UPDATE_SETTINGS, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subscriptionModeEnabled: paid,
          portalMode: paid ? 'paid' : 'free',
        }),
      });
      const result = await res.json();
      setToast(result.success ? 'saved' : 'error');
    } catch {
      setToast('error');
    } finally {
      setIsSaving(false);
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="st-loading">
        <Loader size={22} className="st-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="st-page">

      {/* Toast */}
      {toast && (
        <div className={`st-toast st-toast--${toast}`}>
          {toast === 'saved' ? '✓ Saved' : '✕ Failed to save'}
        </div>
      )}

      {/* Header */}
      <div className="st-header">
        <p className="st-eyebrow">Admin · System</p>
        <h1 className="st-title">Platform Settings</h1>
        <p className="st-sub">Control how users access course content on this platform.</p>
      </div>

      {/* Card */}
      <div className="st-card">
        <div className="st-card-top">
          <span className="st-card-label">Access Mode</span>
          {isSaving && <Loader size={14} className="st-spin st-saving-icon" />}
        </div>
        <p className="st-card-desc">
          Switch between Free and Paid mode. Changes apply immediately across all platforms.
        </p>

        {/* Tiles */}
        <div className="st-tiles">

          {/* Free tile */}
          <button
            className={`st-tile ${!subscriptionModeEnabled ? 'st-tile--free' : ''}`}
            onClick={() => handleSelect(false)}
            disabled={isSaving}
          >
            <div className={`st-tile-icon ${!subscriptionModeEnabled ? 'st-tile-icon--free' : ''}`}>
              <Unlock size={20} />
            </div>
            <div className="st-tile-body">
              <span className="st-tile-name">Free Mode</span>
              <span className="st-tile-detail">All registered users access content freely — no payment required.</span>
            </div>
            <div className={`st-tile-check ${!subscriptionModeEnabled ? 'st-tile-check--free' : ''}`}>
              <Check size={12} />
            </div>
          </button>

          {/* Paid tile */}
          <button
            className={`st-tile ${subscriptionModeEnabled ? 'st-tile--paid' : ''}`}
            onClick={() => handleSelect(true)}
            disabled={isSaving}
          >
            <div className={`st-tile-icon ${subscriptionModeEnabled ? 'st-tile-icon--paid' : ''}`}>
              <ShieldCheck size={20} />
            </div>
            <div className="st-tile-body">
              <span className="st-tile-name">Paid Mode</span>
              <span className="st-tile-detail">Users must purchase a subscription before accessing any content.</span>
            </div>
            <div className={`st-tile-check ${subscriptionModeEnabled ? 'st-tile-check--paid' : ''}`}>
              <Check size={12} />
            </div>
          </button>

        </div>

        {/* Status banner */}
        <div className={`st-banner ${subscriptionModeEnabled ? 'st-banner--paid' : 'st-banner--free'}`}>
          {subscriptionModeEnabled
            ? '🔒  Paid Mode is active — users must subscribe to view courses.'
            : '🔓  Free Mode is active — all registered users can access content.'}
        </div>
      </div>

    </div>
  );
};

export default Settings;