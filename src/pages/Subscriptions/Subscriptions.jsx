import React, { useState, useEffect, useContext, useCallback } from 'react';
import { PendingTabContext } from '../../components/AdminLayout/AdminLayout';
import {
  CreditCard, Settings, Percent, Search, Trash2, Plus,
  CheckCircle, AlertCircle, Save, X, DollarSign, Activity,
  RotateCcw, Sparkles, ToggleLeft, ToggleRight, TrendingUp,
  ShieldCheck, Check, Loader, Edit2,
} from 'lucide-react';
import { SUBSCRIPTION_ENDPOINTS, getAuthHeaders } from '../../utils/api';
import './Subscriptions.css';
import { ShimmerAdminSubscriptions } from '../../components/Shimmer/Shimmer';

// ─── Empty plan template ───────────────────────────────────────────────────────
const EMPTY_NEW_PLAN = {
  name: '',
  description: '',
  isEnabled: true,
  pricing: { PKR: 0, USD: 0, EUR: 0 },
};

const Subscriptions = () => {
  const [activeTab, setActiveTab] = useState('plans');
  const { tab, route, clearPendingTab } = useContext(PendingTabContext);

  // Loading / error state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Settings state (FR-35, FR-38, FR-39)
  const [portalMode, setPortalMode] = useState('paid');
  const [subscriptionModeEnabled, setSubscriptionModeEnabled] = useState(true);
  const [hasTrial, setHasTrial] = useState(false);
  const [trialDays, setTrialDays] = useState(14);
  const [enabledCurrencies, setEnabledCurrencies] = useState({ PKR: true, USD: true, EUR: true });

  // Plans state (FR-40)
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState(null);   // plan being edited
  const [showCreatePlan, setShowCreatePlan] = useState(false); // create modal visibility
  const [newPlan, setNewPlan] = useState(EMPTY_NEW_PLAN);      // create modal state
  const [deletingPlanId, setDeletingPlanId] = useState(null);  // plan being deleted

  // Coupons state
  const [coupons, setCoupons] = useState([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', discount: '', expiry: '' });

  // Payments state
  const [payments, setPayments] = useState([]);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');

  const getToken = () => localStorage.getItem('lms_token');

  const triggerAlert = (msg, type = 'success') => {
    setAlertMsg({ msg, type });
    setTimeout(() => setAlertMsg(null), 3500);
  };

  // ── Fetch full settings from API ──────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.SETTINGS, {
        headers: getAuthHeaders(getToken()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      const s = data.data;
      setPortalMode(s.portalMode || 'paid');
      setSubscriptionModeEnabled(s.subscriptionModeEnabled ?? true);
      setHasTrial(s.hasTrial ?? false);
      setTrialDays(s.trialDays ?? 14);
      setEnabledCurrencies(s.enabledCurrencies ?? { PKR: true, USD: true, EUR: true });
      setPlans(s.plans || []);
      setCoupons(s.coupons || []);
    } catch (err) {
      triggerAlert(err.message || 'Failed to load subscription settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.PAYMENTS, {
        headers: getAuthHeaders(getToken()),
      });
      const data = await res.json();
      if (data.success) setPayments(data.data || []);
    } catch (err) {
      console.error('fetchPayments error:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchPayments();
  }, [fetchSettings, fetchPayments]);

  useEffect(() => {
    if (tab && route === '/admin/subscriptions') {
      setActiveTab(tab);
      clearPendingTab();
    }
  }, [tab, route, clearPendingTab]);

  // ── Save general settings (FR-38, FR-39) ──────────────────────────────────
  const saveGeneralSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.UPDATE_SETTINGS, {
        method: 'PUT',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify({
          subscriptionModeEnabled,
          portalMode,
          hasTrial,
          trialDays,
          enabledCurrencies,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      triggerAlert('General settings saved successfully!');
    } catch (err) {
      triggerAlert(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle currency ────────────────────────────────────────────────────────
  const toggleCurrency = (curr) => {
    const updated = { ...enabledCurrencies, [curr]: !enabledCurrencies[curr] };
    const enabledCount = Object.values(updated).filter(Boolean).length;
    if (enabledCount === 0) {
      triggerAlert('At least one currency must remain active!', 'error');
      return;
    }
    setEnabledCurrencies(updated);
  };

  // ── Plan toggle (FR-40) ───────────────────────────────────────────────────
  const togglePlanEnabled = async (planId) => {
    const plan = plans.find((p) => p.planId === planId);
    if (!plan) return;
    const nextState = !plan.isEnabled;
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.UPDATE_PLAN(planId), {
        method: 'PUT',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify({ isEnabled: nextState }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPlans((prev) => prev.map((p) => (p.planId === planId ? { ...p, isEnabled: nextState } : p)));
      triggerAlert(`${plan.name} is now ${nextState ? 'Enabled' : 'Disabled'}`);
    } catch (err) {
      triggerAlert(err.message || 'Failed to update plan', 'error');
    }
  };

  // ── Create new plan ───────────────────────────────────────────────────────
  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!newPlan.name.trim()) {
      triggerAlert('Plan name is required', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.CREATE_PLAN, {
        method: 'POST',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify(newPlan),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPlans((prev) => [...prev, data.data]);
      setNewPlan(EMPTY_NEW_PLAN);
      setShowCreatePlan(false);
      triggerAlert(`Plan "${data.data.name}" created successfully!`);
    } catch (err) {
      triggerAlert(err.message || 'Failed to create plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Save plan pricing/details (FR-40) ─────────────────────────────────────
  const savePlanPricing = async () => {
    if (!editingPlan) return;
    if (!editingPlan.name?.trim()) {
      triggerAlert('Plan name is required', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.UPDATE_PLAN(editingPlan.planId), {
        method: 'PUT',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify({
          name: editingPlan.name,
          description: editingPlan.description,
          pricing: editingPlan.pricing,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPlans((prev) =>
        prev.map((p) => (p.planId === editingPlan.planId ? { ...p, ...editingPlan } : p))
      );
      setEditingPlan(null);
      triggerAlert('Plan updated successfully!');
    } catch (err) {
      triggerAlert(err.message || 'Failed to update plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete plan ───────────────────────────────────────────────────────────
  const handleDeletePlan = async (planId) => {
    const plan = plans.find((p) => p.planId === planId);
    if (!plan) return;
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      setDeletingPlanId(planId);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.DELETE_PLAN(planId), {
        method: 'DELETE',
        headers: getAuthHeaders(getToken()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPlans((prev) => prev.filter((p) => p.planId !== planId));
      triggerAlert(`Plan "${plan.name}" deleted!`);
    } catch (err) {
      triggerAlert(err.message || 'Failed to delete plan', 'error');
    } finally {
      setDeletingPlanId(null);
    }
  };

  // ── Add coupon ─────────────────────────────────────────────────────────────
  const handleAddCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.discount || !newCoupon.expiry) {
      triggerAlert('Please fill all fields', 'error');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.CREATE_COUPON, {
        method: 'POST',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify(newCoupon),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCoupons((prev) => [data.data, ...prev]);
      setNewCoupon({ code: '', discount: '', expiry: '' });
      triggerAlert('Coupon created successfully!');
    } catch (err) {
      triggerAlert(err.message || 'Failed to create coupon', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete coupon ─────────────────────────────────────────────────────────
  const handleDeleteCoupon = async (code) => {
    if (!window.confirm(`Delete coupon "${code}"?`)) return;
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.DELETE_COUPON(code), {
        method: 'DELETE',
        headers: getAuthHeaders(getToken()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCoupons((prev) => prev.filter((c) => c.code !== code));
      triggerAlert('Coupon deleted!');
    } catch (err) {
      triggerAlert(err.message || 'Failed to delete coupon', 'error');
    }
  };

  // ── Refund payment ────────────────────────────────────────────────────────
  const handleRefund = async (txnId) => {
    if (!window.confirm(`Refund transaction ${txnId}?`)) return;
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.REFUND(txnId), {
        method: 'PATCH',
        headers: getAuthHeaders(getToken()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPayments((prev) =>
        prev.map((p) => (p.txnId === txnId ? { ...p, status: 'Refunded' } : p))
      );
      triggerAlert(`Refund processed for ${txnId}!`);
    } catch (err) {
      triggerAlert(err.message || 'Failed to process refund', 'error');
    }
  };

  // ── Computed metrics ──────────────────────────────────────────────────────
  const activeSubscribersCount = payments.filter((p) => p.status === 'Success').length;
  const activeCouponsCount = coupons.filter((c) => c.status === 'Active').length;
  const failedCount = payments.filter((p) => p.status === 'Failed').length;
  const mrrUSD = payments
    .filter((p) => p.status === 'Success')
    .reduce((sum, p) => {
      let amt = p.amount || 0;
      if (p.currency === 'PKR') amt = amt / 155;
      else if (p.currency === 'EUR') amt = amt * 1.1;
      if (p.planId === 'yearly') amt = amt / 12;
      if (p.planId === 'lifetime') amt = 0;
      return sum + amt;
    }, 0);

  const filteredPayments = payments.filter((p) => {
    const q = paymentSearch.toLowerCase();
    const matchSearch =
      (p.userName || '').toLowerCase().includes(q) ||
      (p.txnId || '').toLowerCase().includes(q) ||
      (p.planName || '').toLowerCase().includes(q);
    if (paymentFilter === 'All') return matchSearch;
    return matchSearch && p.status === paymentFilter;
  });

  if (loading) {
    return (
      <div className="subscriptions-page">
        <ShimmerAdminSubscriptions count={3} />
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      {/* Alert */}
      {alertMsg && (
        <div className={`subscription-toast ${alertMsg.type}`}>
          {alertMsg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{alertMsg.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscription Management</h2>
          <p className="page-subtitle">
            Configure billing modes, plan prices, currencies, discount coupons, and track incoming payments.
          </p>
        </div>
        <div className="header-badges">
          <span className={`billing-mode-badge ${portalMode === 'paid' ? 'paid-mode' : 'free-mode'}`}>
            <Sparkles size={13} />
            <span>Portal Mode: {portalMode === 'paid' ? 'Paid Subscriptions' : 'All Free Access'}</span>
          </span>
        </div>
      </div>

      {/* KPI Cards — commented out */}
      {false && (
      <div className="subscription-kpis-grid">
        <div className="kpi-card gradient-blue">
          <div className="kpi-header">
            <span className="kpi-title">Active Subscribers</span>
            <div className="kpi-icon-wrapper"><ShieldCheck size={20} /></div>
          </div>
          <div className="kpi-value">{activeSubscribersCount}</div>
          <div className="kpi-footer"><TrendingUp size={14} className="trend-icon" /><span>From payment records</span></div>
        </div>

        <div className="kpi-card gradient-purple">
          <div className="kpi-header">
            <span className="kpi-title">Est. MRR (USD)</span>
            <div className="kpi-icon-wrapper"><DollarSign size={20} /></div>
          </div>
          <div className="kpi-value">${Math.round(mrrUSD)}</div>
          <div className="kpi-footer"><span>Dynamic currency conversion</span></div>
        </div>

        <div className="kpi-card gradient-orange">
          <div className="kpi-header">
            <span className="kpi-title">Active Coupons</span>
            <div className="kpi-icon-wrapper"><Percent size={20} /></div>
          </div>
          <div className="kpi-value">{activeCouponsCount}</div>
          <div className="kpi-footer"><span>Reduces checkout barriers</span></div>
        </div>

        <div className="kpi-card gradient-red">
          <div className="kpi-header">
            <span className="kpi-title">Failed Payments</span>
            <div className="kpi-icon-wrapper"><AlertCircle size={20} /></div>
          </div>
          <div className="kpi-value">{failedCount}</div>
          <div className="kpi-footer"><span>Requires manual retry</span></div>
        </div>
      </div>
      )}

      {/* Tabs */}
      <div className="subscriptions-tabs">
        {[
          // { key: 'settings', icon: <Settings size={16} />, label: 'General Settings' },
          { key: 'plans', icon: <CreditCard size={16} />, label: 'Subscription Plans' },
          // { key: 'coupons', icon: <Percent size={16} />, label: 'Discount Coupons' },
          // { key: 'payments', icon: <Activity size={16} />, label: 'Payment Tracking' },
        ].map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-viewport">

        {/* ── Tab 1: General Settings (FR-35, FR-38, FR-39) ── */}
        {false && activeTab === 'settings' && (
          <div className="tab-pane settings-pane">
            <div className="settings-card">
              <h3 className="section-title-sub">Billing Portal Strategy</h3>
              <p className="section-description">
                FR-35/38: Choose how students access the platform — Free or Paid mode.
              </p>
              <div className="settings-controls">
                <div className="control-row">
                  <div className="control-info">
                    <span className="control-label">Enable Subscription Checks</span>
                    <span className="control-sublabel">When disabled, entire platform bypasses checkout.</span>
                  </div>
                  <button type="button" className="toggle-button" onClick={() => setSubscriptionModeEnabled(!subscriptionModeEnabled)}>
                    {subscriptionModeEnabled
                      ? <ToggleRight size={40} className="toggle-icon active" />
                      : <ToggleLeft size={40} className="toggle-icon" />}
                  </button>
                </div>

                <div className="control-row">
                  <div className="control-info">
                    <span className="control-label">Billing Mode Selection</span>
                    <span className="control-sublabel">
                      Free Mode: everyone accesses everything. Paid Mode: subscription required.
                    </span>
                  </div>
                  <div className="mode-toggle-group">
                    <button
                      className={`mode-btn ${portalMode === 'free' ? 'active-free' : ''}`}
                      onClick={() => setPortalMode('free')}
                    >Free Mode</button>
                    <button
                      className={`mode-btn ${portalMode === 'paid' ? 'active-paid' : ''}`}
                      onClick={() => setPortalMode('paid')}
                    >Paid Mode</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="settings-card">
              <h3 className="section-title-sub">Trial Period Administration</h3>
              <div className="settings-controls">
                <div className="control-row">
                  <div className="control-info">
                    <span className="control-label">Offer Trial on Sign-up</span>
                    <span className="control-sublabel">Creates a trial phase upon user registration.</span>
                  </div>
                  <button type="button" className="toggle-button" onClick={() => setHasTrial(!hasTrial)}>
                    {hasTrial
                      ? <ToggleRight size={40} className="toggle-icon active" />
                      : <ToggleLeft size={40} className="toggle-icon" />}
                  </button>
                </div>

                {hasTrial && (
                  <div className="control-row">
                    <div className="control-info">
                      <span className="control-label">Trial Duration (Days)</span>
                    </div>
                    <div className="duration-input-wrapper">
                      <input
                        type="number"
                        value={trialDays}
                        onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="trial-days-input"
                      />
                      <span className="input-suffix">Days</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FR-39: Supported currencies */}
            <div className="settings-card">
              <h3 className="section-title-sub">Supported Currencies (FR-39)</h3>
              <p className="section-description">Allow international checkouts by enabling currencies below.</p>
              <div className="currencies-list">
                {[
                  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
                  { code: 'USD', symbol: '$', name: 'United States Dollar' },
                  { code: 'EUR', symbol: '€', name: 'Euro' },
                ].map(({ code, symbol, name }) => (
                  <div
                    key={code}
                    className={`currency-checkbox-card ${enabledCurrencies[code] ? 'active' : ''}`}
                    onClick={() => toggleCurrency(code)}
                  >
                    <div className="currency-box-header">
                      <span className="currency-symbol">{symbol}</span>
                      <span className="currency-code">{code}</span>
                    </div>
                    <div className="currency-details">{name}</div>
                    <div className="checkbox-indicator">{enabledCurrencies[code] ? <Check size={14} /> : null}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="settings-save-row">
              <button className="btn-primary" onClick={saveGeneralSettings} disabled={saving}>
                {saving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
                <span>{saving ? 'Saving…' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Tab 2: Subscription Plans (FR-40) ── */}
        {activeTab === 'plans' && (
          <div className="tab-pane plans-pane">

            {/* Plans toolbar */}
            <div className="plans-toolbar">
              <div>
                <h3 className="section-title-sub" style={{ margin: 0 }}>Subscription Plans</h3>
                <p className="section-description" style={{ margin: '4px 0 0' }}>
                  {plans.length} plan{plans.length !== 1 ? 's' : ''} configured
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={() => { setNewPlan(EMPTY_NEW_PLAN); setShowCreatePlan(true); }}
              >
                <Plus size={16} />
                <span>Add New Plan</span>
              </button>
            </div>

            <div className="plans-grid-row">
              {plans.length === 0 ? (
                <div className="plans-empty-state">
                  <CreditCard size={40} style={{ opacity: 0.3 }} />
                  <p>No plans yet. Click "Add New Plan" to get started.</p>
                </div>
              ) : plans.map((plan) => (
                <div key={plan.planId} className={`plan-settings-card ${plan.isEnabled ? 'active' : 'disabled'}`}>
                  <div className="plan-card-header">
                    <h3 className="plan-name-title">{plan.name}</h3>
                    <button
                      className={`plan-status-badge-toggle ${plan.isEnabled ? 'enabled' : 'disabled'}`}
                      onClick={() => togglePlanEnabled(plan.planId)}
                    >
                      {plan.isEnabled ? 'Active' : 'Inactive'}
                    </button>
                  </div>

                  {plan.description && (
                    <p className="plan-description-text">{plan.description}</p>
                  )}

                  <div className="plan-card-body">
                    <div className="pricing-listing">
                      {[['₨', 'PKR'], ['$', 'USD'], ['€', 'EUR']].map(([sym, curr]) => (
                        <div className="pricing-curr-row" key={curr}>
                          <span className="curr-label">{sym} {curr}:</span>
                          <span className="curr-price">{sym} {plan.pricing?.[curr] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="plan-card-footer">
                    <button
                      className="btn-outline-primary plan-edit-btn"
                      onClick={() => setEditingPlan(JSON.parse(JSON.stringify(plan)))}
                    >
                      <Edit2 size={14} />
                      <span>Edit Plan</span>
                    </button>
                    <button
                      className="btn-outline-danger plan-delete-btn"
                      onClick={() => handleDeletePlan(plan.planId)}
                      disabled={deletingPlanId === plan.planId}
                      title="Delete plan"
                    >
                      {deletingPlanId === plan.planId
                        ? <Loader size={14} className="spin-icon" />
                        : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Create Plan Modal ── */}
            {showCreatePlan && (
              <div className="editing-backdrop">
                <div className="editing-modal plan-modal-compact">
                  <div className="modal-header">
                    <h3>Create New Plan</h3>
                    <button className="close-x" onClick={() => setShowCreatePlan(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body modal-body-compact">
                    <div className="modal-row-2col">
                      <div className="form-group">
                        <label>Plan Name <span className="required-star">*</span></label>
                        <input
                          type="text"
                          placeholder="e.g. Premium Monthly"
                          value={newPlan.name}
                          onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          type="text"
                          placeholder="Brief plan description…"
                          value={newPlan.description}
                          onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="modal-pricing-label">Pricing per currency</div>
                    <div className="modal-row-3col">
                      {[['PKR', '₨'], ['USD', '$'], ['EUR', '€']].map(([curr, sym]) => (
                        <div className="form-group" key={curr}>
                          <label>{sym} {curr}</label>
                          <div className="input-prefix-box">
                            <span className="prefix-sign">{sym}</span>
                            <input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={newPlan.pricing?.[curr] ?? 0}
                              onChange={(e) => setNewPlan({
                                ...newPlan,
                                pricing: { ...newPlan.pricing, [curr]: parseInt(e.target.value) || 0 },
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="modal-toggle-row">
                      <span className="control-label">Enable plan immediately</span>
                      <button
                        type="button"
                        className="toggle-button"
                        onClick={() => setNewPlan({ ...newPlan, isEnabled: !newPlan.isEnabled })}
                      >
                        {newPlan.isEnabled
                          ? <ToggleRight size={36} className="toggle-icon active" />
                          : <ToggleLeft size={36} className="toggle-icon" />}
                      </button>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowCreatePlan(false)}>Cancel</button>
                    <button className="btn-primary" onClick={handleCreatePlan} disabled={saving}>
                      {saving ? <Loader size={16} className="spin-icon" /> : <Plus size={16} />}
                      <span>{saving ? 'Creating…' : 'Create Plan'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Edit Plan Modal ── */}
            {editingPlan && (
              <div className="editing-backdrop">
                <div className="editing-modal">
                  <div className="modal-header">
                    <h3>Edit Plan: {editingPlan.name}</h3>
                    <button className="close-x" onClick={() => setEditingPlan(null)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Plan Name <span className="required-star">*</span></label>
                      <input
                        type="text"
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={editingPlan.description}
                        onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                        rows={2}
                        className="plan-description-textarea"
                      />
                    </div>
                    <p className="modal-sub">Set multi-currency pricing targets for this plan.</p>
                    <div className="modal-inputs">
                      {[['PKR', '₨', 'Pakistani Rupee'], ['USD', '$', 'US Dollar'], ['EUR', '€', 'Euro']].map(([curr, sym, label]) => (
                        <div className="form-group" key={curr}>
                          <label>Pricing in {label} ({curr})</label>
                          <div className="input-prefix-box">
                            <span className="prefix-sign">{sym}</span>
                            <input
                              type="number"
                              min="0"
                              value={editingPlan.pricing?.[curr] ?? 0}
                              onChange={(e) => setEditingPlan({
                                ...editingPlan,
                                pricing: { ...editingPlan.pricing, [curr]: parseInt(e.target.value) || 0 },
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setEditingPlan(null)}>Cancel</button>
                    <button className="btn-primary" onClick={savePlanPricing} disabled={saving}>
                      {saving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
                      <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Coupons ── */}
        {false && activeTab === 'coupons' && (
          <div className="tab-pane coupons-pane">
            <div className="coupons-layout">
              <div className="coupon-form-card">
                <h3 className="section-title-sub">Generate Discount Coupon</h3>
                <form className="coupon-form" onSubmit={handleAddCoupon}>
                  <div className="form-group">
                    <label>Coupon Code</label>
                    <input
                      type="text"
                      placeholder="e.g. SUMMER50"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Discount (%)</label>
                      <input
                        type="number"
                        min="1" max="100"
                        placeholder="Discount %"
                        value={newCoupon.discount}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Expiry Date</label>
                      <input
                        type="date"
                        value={newCoupon.expiry}
                        onChange={(e) => setNewCoupon({ ...newCoupon, expiry: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary-block" disabled={saving}>
                    {saving ? <Loader size={16} className="spin-icon" /> : <Plus size={16} />}
                    <span>Create Discount Coupon</span>
                  </button>
                </form>
              </div>

              <div className="coupons-list-card">
                <h3 className="section-title-sub">Active Campaign Coupons</h3>
                <div className="coupons-table-wrapper">
                  <table className="coupons-table">
                    <thead>
                      <tr>
                        <th>Code</th><th>Discount</th><th>Expiry</th><th>Status</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.length === 0 ? (
                        <tr><td colSpan={5} className="no-records-row">No coupons created yet.</td></tr>
                      ) : coupons.map((c, i) => (
                        <tr key={i}>
                          <td><span className="coupon-code-span">{c.code}</span></td>
                          <td><span className="coupon-discount-span">{c.discount}% OFF</span></td>
                          <td>{c.expiry ? new Date(c.expiry).toLocaleDateString() : '—'}</td>
                          <td>
                            <span className={`coupon-status-badge ${c.status?.toLowerCase()}`}>
                              {c.status}
                            </span>
                          </td>
                          <td>
                            <button className="delete-coupon-btn" onClick={() => handleDeleteCoupon(c.code)} title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 4: Payments ── */}
        {false && activeTab === 'payments' && (
          <div className="tab-pane payments-pane">
            <div className="payment-tracking-card">
              <div className="payments-toolbar">
                <div className="search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search by user, TXN ID, or plan…"
                    value={paymentSearch}
                    onChange={(e) => setPaymentSearch(e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  {['All', 'Success', 'Failed', 'Refunded', 'Pending'].map((f) => (
                    <button
                      key={f}
                      className={`filter-tab-btn ${paymentFilter === f ? 'active' : ''}`}
                      onClick={() => setPaymentFilter(f)}
                    >{f}</button>
                  ))}
                </div>
              </div>

              <div className="payments-table-wrapper">
                <table className="payments-table">
                  <thead>
                    <tr>
                      <th>TXN ID</th><th>Student</th><th>Plan</th><th>Paid Amount</th>
                      <th>Date</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="no-records-row">
                          <AlertCircle size={20} className="no-records-icon" />
                          <span>No transaction records found.</span>
                        </td>
                      </tr>
                    ) : filteredPayments.map((p) => (
                      <tr key={p.txnId}>
                        <td className="txn-id-cell">{p.txnId}</td>
                        <td className="student-name-cell">
                          <div>{p.userName || '—'}</div>
                          <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{p.userEmail}</small>
                        </td>
                        <td className="plan-cell">{p.planName}</td>
                        <td className="amount-cell">
                          <span className="price-bold">
                            {p.currency === 'PKR' ? '₨ ' : p.currency === 'EUR' ? '€ ' : '$ '}
                            {p.amount?.toLocaleString()}
                          </span>
                        </td>
                        <td className="date-cell">
                          {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span className={`payment-status-tag ${p.status?.toLowerCase()}`}>
                            {p.status}
                          </span>
                        </td>
                        <td>
                          {p.status === 'Success' ? (
                            <button className="refund-btn-action" onClick={() => handleRefund(p.txnId)} title="Refund">
                              <RotateCcw size={13} /><span>Refund</span>
                            </button>
                          ) : (
                            <span className="action-text-muted">{p.status === 'Refunded' ? 'Refunded' : '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Subscriptions;