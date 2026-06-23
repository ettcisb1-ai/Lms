import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, Check, Percent, Sparkles, AlertCircle, ShieldCheck,
  Ticket, ChevronLeft, Loader, CheckCircle, RefreshCw
} from 'lucide-react';
import { SUBSCRIPTION_ENDPOINTS, AUTH_ENDPOINTS, getAuthHeaders } from '../../utils/api';
import './UserSubscriptions.css';
import { ShimmerUserSubscriptions } from '../../components/Shimmer/Shimmer';

const UserSubscriptions = () => {
  const navigate = useNavigate();
  const getToken = () => localStorage.getItem('lms_token');

  // Portal / plan data from API
  const [portalInfo, setPortalInfo] = useState(null);
  const [mySubscription, setMySubscription] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);

  // Checkout flow
  const [checkoutStep, setCheckoutStep] = useState('plans'); // 'plans' | 'checkout' | 'success'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState('PKR');

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  // Card form
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const triggerAlert = (msg, type = 'success') => {
    setAlertMsg({ msg, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // ── Load portal info (plans, mode) + own subscription ──────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoadingInfo(true);

      // Public endpoint — no auth needed
      const [pubRes, myRes] = await Promise.all([
        fetch(SUBSCRIPTION_ENDPOINTS.PUBLIC),
        fetch(SUBSCRIPTION_ENDPOINTS.MY_SUBSCRIPTION, {
          headers: getAuthHeaders(getToken()),
        }),
      ]);

      const pubData = await pubRes.json();
      if (pubData.success) {
        setPortalInfo(pubData.data);
        if (pubData.data.plans?.length > 0) {
          setSelectedPlan(pubData.data.plans[0]);
        }
        // Set first enabled currency
        const firstEnabled = Object.entries(pubData.data.enabledCurrencies || {})
          .find(([, v]) => v);
        if (firstEnabled) setSelectedCurrency(firstEnabled[0]);
      }

      const myData = await myRes.json();
      if (myData.success) setMySubscription(myData.data);
    } catch (err) {
      console.error('loadData error:', err);
      triggerAlert('Failed to load subscription information', 'error');
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Validate coupon via API ────────────────────────────────────────────────
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      setCouponLoading(true);
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.VALIDATE_COUPON, {
        method: 'POST',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (data.success) {
        setAppliedCoupon(data.data);
        setCouponCode('');
      } else {
        setCouponError(data.message || 'Invalid coupon code');
      }
    } catch (err) {
      setCouponError('Failed to validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  // ── Purchase subscription (FR-37, FR-41) ──────────────────────────────────
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) return;
    if (!selectedPlan) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(SUBSCRIPTION_ENDPOINTS.PURCHASE, {
        method: 'POST',
        headers: getAuthHeaders(getToken()),
        body: JSON.stringify({
          planId: selectedPlan.planId,
          currency: selectedCurrency,
          couponCode: appliedCoupon?.code || '',
          cardName,
          cardLast4: cardNumber.replace(/\s/g, '').slice(-4),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // Update stored user profile token/data if needed
      const profileRes = await fetch(AUTH_ENDPOINTS.PROFILE, {
        headers: getAuthHeaders(getToken()),
      });
      const profileData = await profileRes.json();
      if (profileData.success) {
        const stored = localStorage.getItem('lms_user_profile');
        const parsed = stored ? JSON.parse(stored) : {};
        localStorage.setItem('lms_user_profile', JSON.stringify({
          ...parsed,
          ...profileData.data,
        }));
      }

      setReceiptData(data.data);
      setMySubscription((prev) => ({ ...prev, user: data.data.user }));
      setCheckoutStep('success');
    } catch (err) {
      triggerAlert(err.message || 'Payment failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Card input formatters ─────────────────────────────────────────────────
  const formatCardNumber = (e) => {
    const v = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    const parts = [];
    for (let i = 0; i < v.length && i < 16; i += 4) parts.push(v.substring(i, i + 4));
    setCardNumber(parts.join(' '));
  };

  const formatCardExpiry = (e) => {
    const v = e.target.value.replace(/\D/g, '');
    if (v.length >= 2) setCardExpiry(v.substring(0, 2) + '/' + v.substring(2, 4));
    else setCardExpiry(v);
  };

  const getCurrencySymbol = (code) => ({ PKR: '₨', EUR: '€', USD: '$' }[code] || '$');

  // ── Computed pricing ──────────────────────────────────────────────────────
  const rawPrice = selectedPlan?.pricing?.[selectedCurrency] ?? 0;
  const discountAmount = appliedCoupon
    ? Math.round((rawPrice * appliedCoupon.discount) / 100)
    : 0;
  const finalPrice = Math.max(0, rawPrice - discountAmount);
  const userInfo = mySubscription?.user;
  const activePlans = portalInfo?.plans || [];
  const enabledCurrencies = portalInfo?.enabledCurrencies || { PKR: true };

  if (loadingInfo) {
    return (
      <div className="user-subscriptions-page">
        <ShimmerUserSubscriptions count={3} />
      </div>
    );
  }

  return (
    <div className="user-subscriptions-page">
      {/* Alert */}
      {alertMsg && (
        <div className={`user-sub-toast ${alertMsg.type}`}>
          {alertMsg.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{alertMsg.msg}</span>
        </div>
      )}

      {/* FR-36: Free mode banner */}
      {portalInfo?.portalMode === 'free' && (
        <div className="free-mode-banner">
          <Sparkles size={18} />
          <div>
            <strong>LMS Free Access active!</strong>
            <p>Admin has enabled Free Mode — all lectures are accessible without a subscription.</p>
          </div>
        </div>
      )}

      {/* ── STEP 1: Plan Selection ── */}
      {checkoutStep === 'plans' && (
        <div className="billing-step-plans animate-view">
          {/* Current subscription status */}
          {userInfo?.subscribed && (
            <div className="current-sub-banner">
              <ShieldCheck size={20} />
              <div>
                <strong>Current Plan: {userInfo.planType}</strong>
                <p>Expires: {userInfo.expiryDate} · Currency: {userInfo.currency}</p>
              </div>
              <button className="btn-refresh" onClick={loadData} title="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          <div className="billing-heading">
            <h2>Select Your Premium Plan</h2>
            <p>Upgrade to unlock advanced lectures, HD streams, and certificates.</p>

            {/* Currency selector */}
            <div className="currency-selector-row">
              {Object.entries(enabledCurrencies).map(([curr, enabled]) => {
                if (!enabled) return null;
                return (
                  <button
                    key={curr}
                    className={`currency-pill ${selectedCurrency === curr ? 'active' : ''}`}
                    onClick={() => setSelectedCurrency(curr)}
                  >
                    {curr} ({getCurrencySymbol(curr)})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="student-plans-grid">
            {activePlans.length === 0 ? (
              <div className="no-plans-msg">
                <AlertCircle size={24} />
                <p>No subscription plans are currently available. Please check back later.</p>
              </div>
            ) : activePlans.map((plan) => {
              const isCurrent = userInfo?.subscribed && userInfo?.planType === plan.name;
              return (
                <div
                  key={plan.planId}
                  className={`student-plan-card ${isCurrent ? 'current-plan' : ''} ${plan.planId === 'yearly' ? 'recommended' : ''}`}
                >
                  {plan.planId === 'yearly' && <div className="recommended-badge">BEST VALUE</div>}
                  <div className="plan-card-top">
                    <h3>{plan.name}</h3>
                    <p className="plan-desc">{plan.description || 'Full curriculum access.'}</p>
                  </div>

                  <div className="plan-price-tier">
                    <span className="price-symbol">{getCurrencySymbol(selectedCurrency)}</span>
                    <span className="price-bold">
                      {plan.pricing?.[selectedCurrency]?.toLocaleString() ?? 0}
                    </span>
                    <span className="price-period">
                      {plan.planId === 'lifetime' ? 'once' : plan.planId === 'yearly' ? '/year' : '/month'}
                    </span>
                  </div>

                  <div className="plan-features-list">
                    <div className="feat-item"><Check size={14} /><span>Secure HLS streams</span></div>
                    <div className="feat-item"><Check size={14} /><span>Dynamic watermarks</span></div>
                    <div className="feat-item"><Check size={14} /><span>Discussion forums &amp; Q&amp;A</span></div>
                    {plan.planId !== 'monthly' && (
                      <div className="feat-item"><Check size={14} /><span>Certificate exports</span></div>
                    )}
                  </div>

                  <div className="plan-card-footer">
                    {isCurrent ? (
                      <span className="active-plan-badge">
                        <Check size={14} /> Active Plan
                      </span>
                    ) : (
                      <button
                        className="btn-select-plan"
                        onClick={() => {
                          setSelectedPlan(plan);
                          setCheckoutStep('checkout');
                        }}
                      >
                        Choose {plan.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment history */}
          {mySubscription?.paymentHistory?.length > 0 && (
            <div className="payment-history-section">
              <h3>Your Payment History</h3>
              <div className="payment-history-table-wrap">
                <table className="payment-history-table">
                  <thead>
                    <tr><th>TXN ID</th><th>Plan</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {mySubscription.paymentHistory.map((p) => (
                      <tr key={p.txnId}>
                        <td className="txn-id">{p.txnId}</td>
                        <td>{p.planName}</td>
                        <td>{getCurrencySymbol(p.currency)}{p.amount?.toLocaleString()}</td>
                        <td>{p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className={`history-status ${p.status?.toLowerCase()}`}>{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Checkout ── */}
      {checkoutStep === 'checkout' && (
        <div className="billing-step-checkout animate-view">
          <button className="back-btn" onClick={() => setCheckoutStep('plans')}>
            <ChevronLeft size={16} /><span>Back to pricing options</span>
          </button>

          <div className="checkout-workspace-grid">
            {/* Payment form */}
            <div className="checkout-payment-card">
              <h3>Secure Checkout Payment</h3>
              <p className="checkout-sec-sub">Card transactions are encrypted end-to-end.</p>

              {/* Card preview */}
              <div className="card-mockup-widget">
                <div className="card-mock-glow"></div>
                <div className="card-mock-top">
                  <CreditCard size={32} />
                  <span className="card-mock-type">Secure Link</span>
                </div>
                <div className="card-mock-number">{cardNumber || '•••• •••• •••• ••••'}</div>
                <div className="card-mock-bottom">
                  <div>
                    <span className="lbl-tiny">CARDHOLDER</span>
                    <span className="lbl-val">{cardName.toUpperCase() || 'YOUR NAME'}</span>
                  </div>
                  <div>
                    <span className="lbl-tiny">EXPIRES</span>
                    <span className="lbl-val">{cardExpiry || 'MM/YY'}</span>
                  </div>
                </div>
              </div>

              <form className="payment-form-element" onSubmit={handleCheckoutSubmit}>
                <div className="form-group">
                  <label>Cardholder Name</label>
                  <input
                    type="text" placeholder="e.g. Ali Ahmed"
                    value={cardName} onChange={(e) => setCardName(e.target.value)} required
                  />
                </div>
                <div className="form-group">
                  <label>Card Number</label>
                  <input
                    type="text" placeholder="0000 0000 0000 0000"
                    maxLength="19" value={cardNumber} onChange={formatCardNumber} required
                  />
                </div>
                <div className="form-double-row">
                  <div className="form-group">
                    <label>Expiration Date</label>
                    <input
                      type="text" placeholder="MM/YY" maxLength="5"
                      value={cardExpiry} onChange={formatCardExpiry} required
                    />
                  </div>
                  <div className="form-group">
                    <label>CVV</label>
                    <input
                      type="password" placeholder="•••" maxLength="3"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))} required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`btn-purchase-submit ${isSubmitting ? 'loading' : ''}`}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? <><Loader size={16} className="sub-spin" /> Processing Payment…</>
                    : `Authorize Payment: ${getCurrencySymbol(selectedCurrency)}${finalPrice.toLocaleString()}`}
                </button>
              </form>
            </div>

            {/* Order summary */}
            <div className="checkout-summary-column">
              <div className="order-summary-card">
                <h3>Order Summary</h3>
                <div className="summary-plan-details">
                  <h4>{selectedPlan?.name}</h4>
                  <p>{selectedPlan?.description}</p>
                </div>

                <div className="summary-price-breakdown">
                  <div className="price-item">
                    <span>Base Subscription</span>
                    <span>{getCurrencySymbol(selectedCurrency)}{rawPrice.toLocaleString()}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="price-item discount-item">
                      <span>Discount ({appliedCoupon.discount}% OFF)</span>
                      <span>-{getCurrencySymbol(selectedCurrency)}{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="price-total-row">
                    <span>Total Authorized</span>
                    <span>{getCurrencySymbol(selectedCurrency)}{finalPrice.toLocaleString()}</span>
                  </div>
                </div>

                {/* Coupon input — commented out */}
                {false && (
                <div className="coupon-code-form-wrapper">
                  {appliedCoupon ? (
                    <div className="applied-coupon-pill">
                      <div className="coupon-left">
                        <Ticket size={14} />
                        <span><strong>{appliedCoupon.code}</strong> — {appliedCoupon.discount}% off</span>
                      </div>
                      <button className="remove-coupon-btn" onClick={() => setAppliedCoupon(null)}>Remove</button>
                    </div>
                  ) : (
                    <form className="coupon-code-form" onSubmit={handleApplyCoupon}>
                      <input
                        type="text"
                        placeholder="Promo Code (e.g. WELCOME50)"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      />
                      <button type="submit" disabled={couponLoading}>
                        {couponLoading ? <Loader size={13} className="sub-spin" /> : 'Apply'}
                      </button>
                    </form>
                  )}
                  {couponError && (
                    <p className="coupon-err-msg"><AlertCircle size={11} /> {couponError}</p>
                  )}
                </div>
                )}

                <div className="summary-trust-info">
                  <ShieldCheck size={16} />
                  <span>256-bit SSL Encrypted Secure Gateway</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Success Receipt (FR-41) ── */}
      {checkoutStep === 'success' && receiptData && (
        <div className="billing-step-success animate-view">
          <div className="success-receipt-card">
            <div className="receipt-badge-circle">
              <Check size={32} />
            </div>

            <h2>Subscription Activated! 🎉</h2>
            <p>Your subscription is confirmed. A digital receipt is shown below.</p>

            <div className="digital-receipt-element">
              <div className="receipt-header">
                <h3>LMS PORTAL INVOICE RECEIPT</h3>
                <span className="receipt-txn">TRANSACTION: {receiptData.txnId}</span>
              </div>

              <div className="receipt-table">
                <div className="receipt-row">
                  <span>Student Name</span><strong>{receiptData.user?.name}</strong>
                </div>
                <div className="receipt-row">
                  <span>Student Email</span><strong>{receiptData.user?.email}</strong>
                </div>
                <div className="receipt-row">
                  <span>Authorized Plan</span><strong>{receiptData.planName}</strong>
                </div>
                <div className="receipt-row">
                  <span>Currency</span><strong>{receiptData.currency}</strong>
                </div>
                {receiptData.couponApplied && (
                  <div className="receipt-row">
                    <span>Coupon Applied</span>
                    <strong>{receiptData.couponApplied} (−{getCurrencySymbol(receiptData.currency)}{receiptData.discountAmount?.toLocaleString()})</strong>
                  </div>
                )}
                <div className="receipt-row">
                  <span>Paid Total</span>
                  <strong>{getCurrencySymbol(receiptData.currency)}{receiptData.amount?.toLocaleString()}</strong>
                </div>
                <div className="receipt-row">
                  <span>Invoice Status</span>
                  <strong className="text-success-stamp">PAID — SUCCESS</strong>
                </div>
                <div className="receipt-row">
                  <span>Valid Period</span>
                  <strong>{receiptData.user?.purchaseDate} → {receiptData.user?.expiryDate}</strong>
                </div>
              </div>

              <div className="receipt-security-footer">
                <span>Receipt generated and stored securely · TXN {receiptData.txnId}</span>
              </div>
            </div>

            <button
              className="btn-classroom-resume"
              onClick={() => navigate('/dashboard/courses')}
            >
              <span>🎓 Launch Classroom &amp; Start Learning</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSubscriptions;