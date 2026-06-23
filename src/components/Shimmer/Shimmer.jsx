import React from 'react';
import './Shimmer.css';

// ─── Base shimmer block ───────────────────────────────────────────────────────
export const ShimmerBlock = ({ className = '', style = {} }) => (
  <div className={`shimmer-block ${className}`} style={style} />
);

// ─── Single stat card skeleton ────────────────────────────────────────────────
export const ShimmerStatCard = () => (
  <div className="shimmer-stat-card">
    <ShimmerBlock className="shimmer-icon" />
    <ShimmerBlock className="shimmer-value" />
    <ShimmerBlock className="shimmer-label" />
    <ShimmerBlock className="shimmer-sub" />
  </div>
);

// ─── Single chart card skeleton ────────────────────────────────────────────────
export const ShimmerChartCard = () => (
  <div className="shimmer-chart-card">
    <ShimmerBlock className="shimmer-chart-title" />
    <ShimmerBlock className="shimmer-chart-sub" />
    <ShimmerBlock className="shimmer-chart-body" />
  </div>
);

// ─── Activity section skeleton ─────────────────────────────────────────────────
export const ShimmerActivitySection = () => (
  <div className="shimmer-activity-section">
    <div className="shimmer-activity-header">
      <ShimmerBlock className="shimmer-section-title" />
      <div className="shimmer-tabs">
        <ShimmerBlock className="shimmer-tab-btn" />
        <ShimmerBlock className="shimmer-tab-btn" />
        <ShimmerBlock className="shimmer-tab-btn" />
      </div>
    </div>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="shimmer-table-row">
        <ShimmerBlock className="shimmer-avatar" />
        <div className="shimmer-row-lines">
          <ShimmerBlock className="shimmer-row-name" />
          <ShimmerBlock className="shimmer-row-email" />
        </div>
        <ShimmerBlock className="shimmer-badge" />
        <ShimmerBlock style={{ width: 60, height: 12, borderRadius: 4, flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

// ─── Full Admin Dashboard skeleton ────────────────────────────────────────────
export const ShimmerDashboard = () => (
  <div className="dashboard-page shimmer-page-wrapper">
    {/* Header */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ShimmerBlock style={{ width: 160, height: 24, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 220, height: 13, borderRadius: 4 }} />
      </div>
      <ShimmerBlock style={{ width: 100, height: 36, borderRadius: 8 }} />
    </div>

    {/* 8 stat cards */}
    <div className="shimmer-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <ShimmerStatCard key={i} />)}
    </div>

    {/* 2 chart cards */}
    <div className="shimmer-charts-row-2">
      <ShimmerChartCard />
      <ShimmerChartCard />
    </div>

    {/* 2 chart cards */}
    <div className="shimmer-charts-row-2">
      <ShimmerChartCard />
      <ShimmerChartCard />
    </div>

    {/* Activity section */}
    <ShimmerActivitySection />
  </div>
);

// ─── User Dashboard skeleton ───────────────────────────────────────────────────
export const ShimmerUserDashboard = () => (
  <div className="user-dashboard-page shimmer-page-wrapper">
    {/* Banner */}
    <div className="shimmer-banner">
      <div className="shimmer-banner-left">
        <ShimmerBlock className="shimmer-banner-title" />
        <ShimmerBlock className="shimmer-banner-sub" />
        <ShimmerBlock className="shimmer-banner-sub" style={{ width: '55%' }} />
        <ShimmerBlock className="shimmer-banner-btn" />
      </div>
      <ShimmerBlock className="shimmer-banner-right" />
    </div>

    {/* 3 stat cards */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
      {[1, 2, 3].map(i => <ShimmerStatCard key={i} />)}
    </div>

    {/* Course cards grid */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ShimmerBlock style={{ width: 180, height: 18, borderRadius: 6 }} />
      <div className="shimmer-courses-grid">
        {[1, 2, 3].map(i => <ShimmerCourseCard key={i} />)}
      </div>
    </div>
  </div>
);

// ─── Single course card skeleton ───────────────────────────────────────────────
export const ShimmerCourseCard = () => (
  <div className="shimmer-course-card">
    <ShimmerBlock className="shimmer-card-image" />
    <div className="shimmer-card-body">
      <ShimmerBlock className="shimmer-card-cat" />
      <ShimmerBlock className="shimmer-card-title" />
      <ShimmerBlock className="shimmer-card-title-2" />
      <ShimmerBlock className="shimmer-card-meta" />
      <ShimmerBlock className="shimmer-card-btn" />
    </div>
  </div>
);

// ─── User Courses page skeleton ────────────────────────────────────────────────
export const ShimmerUserCourses = ({ count = 6 }) => (
  <div className="shimmer-page-wrapper" style={{ gap: 20 }}>
    {/* Toolbar */}
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <ShimmerBlock style={{ flex: 1, height: 40, borderRadius: 8 }} />
      <ShimmerBlock style={{ width: 80, height: 32, borderRadius: 20 }} />
      <ShimmerBlock style={{ width: 80, height: 32, borderRadius: 20 }} />
    </div>
    <div className="shimmer-courses-grid">
      {Array.from({ length: count }).map((_, i) => <ShimmerCourseCard key={i} />)}
    </div>
  </div>
);

// ─── Admin Courses page skeleton (table rows) ──────────────────────────────
export const ShimmerAdminCourses = ({ count = 6 }) => (
  <div className="shimmer-table-wrapper" style={{ borderRadius: 0, border: 'none', boxShadow: 'none' }}>
    <div className="shimmer-table-header">
      <ShimmerBlock className="shimmer-th" style={{ width: '25%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '10%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '8%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '8%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '6%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '12%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '15%', marginLeft: 'auto' }} />
    </div>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="shimmer-table-row">
        {/* thumb + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 2 }}>
          <ShimmerBlock style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <ShimmerBlock style={{ width: '70%', height: 13, borderRadius: 4 }} />
            <ShimmerBlock style={{ width: '45%', height: 10, borderRadius: 4, opacity: 0.6 }} />
          </div>
        </div>
        <ShimmerBlock style={{ width: 80, height: 12, borderRadius: 4, flex: 1 }} />
        <ShimmerBlock style={{ width: 70, height: 22, borderRadius: 20 }} />
        <ShimmerBlock style={{ width: 70, height: 22, borderRadius: 20 }} />
        <ShimmerBlock style={{ width: 55, height: 22, borderRadius: 20 }} />
        <ShimmerBlock style={{ width: 100, height: 12, borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <ShimmerBlock style={{ width: 110, height: 32, borderRadius: 6 }} />
          <ShimmerBlock style={{ width: 32, height: 32, borderRadius: 6 }} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Single video card skeleton ────────────────────────────────────────────────
export const ShimmerVideoCard = () => (
  <div className="shimmer-video-card">
    <ShimmerBlock className="shimmer-video-thumb" />
    <div className="shimmer-video-body">
      <ShimmerBlock className="shimmer-video-title" />
      <ShimmerBlock className="shimmer-video-meta" />
      <ShimmerBlock className="shimmer-video-course" />
      <ShimmerBlock className="shimmer-video-course" style={{ width: '45%' }} />
    </div>
  </div>
);

// ─── Videos page skeleton ──────────────────────────────────────────────────────
export const ShimmerVideos = ({ count = 6 }) => (
  <div className="shimmer-videos-grid">
    {Array.from({ length: count }).map((_, i) => <ShimmerVideoCard key={i} />)}
  </div>
);

// ─── Single notification row skeleton ─────────────────────────────────────────
export const ShimmerNotificationRow = () => (
  <div className="shimmer-notification-row">
    <ShimmerBlock className="shimmer-notif-icon" />
    <div className="shimmer-notif-body">
      <ShimmerBlock className="shimmer-notif-title" />
      <ShimmerBlock className="shimmer-notif-text" />
    </div>
    <ShimmerBlock className="shimmer-notif-time" />
  </div>
);

// ─── Notifications page skeleton ──────────────────────────────────────────────
export const ShimmerNotifications = ({ count = 5 }) => (
  <div className="shimmer-notifications-stack">
    {Array.from({ length: count }).map((_, i) => <ShimmerNotificationRow key={i} />)}
  </div>
);

// ─── Single plan card skeleton ────────────────────────────────────────────────
export const ShimmerPlanCard = () => (
  <div className="shimmer-plan-card">
    <ShimmerBlock className="shimmer-plan-name" />
    <ShimmerBlock className="shimmer-plan-desc" />
    <ShimmerBlock className="shimmer-plan-price" />
    {[1, 2, 3].map(i => <ShimmerBlock key={i} className="shimmer-plan-feat" />)}
    <ShimmerBlock className="shimmer-plan-btn" />
  </div>
);

// ─── User Subscriptions page skeleton ────────────────────────────────────────
export const ShimmerUserSubscriptions = ({ count = 3 }) => (
  <div className="shimmer-page-wrapper" style={{ gap: 24 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ShimmerBlock style={{ width: 260, height: 28, borderRadius: 8 }} />
      <ShimmerBlock style={{ width: 350, height: 14, borderRadius: 5, opacity: 0.6 }} />
    </div>
    <div className="shimmer-plans-grid">
      {Array.from({ length: count }).map((_, i) => <ShimmerPlanCard key={i} />)}
    </div>
  </div>
);

// ─── Admin Subscriptions page skeleton ────────────────────────────────────────
export const ShimmerAdminSubscriptions = ({ count = 3 }) => (
  <div className="shimmer-page-wrapper" style={{ gap: 24 }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ShimmerBlock style={{ width: 260, height: 24, borderRadius: 7 }} />
      <ShimmerBlock style={{ width: 380, height: 13, borderRadius: 4, opacity: 0.6 }} />
    </div>
    <div className="shimmer-plans-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer-plan-card" style={{ gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ShimmerBlock style={{ width: '50%', height: 18, borderRadius: 6 }} />
            <ShimmerBlock style={{ width: 70, height: 26, borderRadius: 20 }} />
          </div>
          <ShimmerBlock style={{ width: '75%', height: 12, borderRadius: 4, opacity: 0.6 }} />
          {[1, 2, 3].map(j => (
            <div key={j} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <ShimmerBlock style={{ width: '35%', height: 12, borderRadius: 4 }} />
              <ShimmerBlock style={{ width: '25%', height: 12, borderRadius: 4 }} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <ShimmerBlock style={{ flex: 1, height: 34, borderRadius: 8 }} />
            <ShimmerBlock style={{ width: 40, height: 34, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Single users table row skeleton ─────────────────────────────────────────
export const ShimmerTableRow = () => (
  <div className="shimmer-table-row">
    <ShimmerBlock className="shimmer-avatar" />
    <div className="shimmer-row-lines" style={{ flex: 1.5 }}>
      <ShimmerBlock className="shimmer-row-name" />
      <ShimmerBlock className="shimmer-row-email" />
    </div>
    <ShimmerBlock className="shimmer-badge" />
    <ShimmerBlock className="shimmer-pill" />
    <div style={{ flex: 1 }}>
      <ShimmerBlock style={{ width: '70%', height: 12, borderRadius: 4 }} />
    </div>
    <div style={{ flex: 1 }}>
      <ShimmerBlock style={{ width: '60%', height: 12, borderRadius: 4 }} />
    </div>
    <div className="shimmer-actions">
      {[1, 2, 3, 4].map(i => <ShimmerBlock key={i} className="shimmer-btn" />)}
    </div>
  </div>
);

// ─── Users page skeleton ──────────────────────────────────────────────────────
export const ShimmerUsers = ({ count = 5 }) => (
  <div className="shimmer-table-wrapper">
    <div className="shimmer-table-header">
      <ShimmerBlock className="shimmer-th" style={{ width: '25%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '8%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '8%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '10%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '15%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '15%' }} />
      <ShimmerBlock className="shimmer-th" style={{ width: '10%' }} />
    </div>
    {Array.from({ length: count }).map((_, i) => <ShimmerTableRow key={i} />)}
  </div>
);

// ─── Categories page skeleton ─────────────────────────────────────────────────
export const ShimmerCategories = ({ count = 5 }) => (
  <div className="shimmer-table-wrapper">
    <div className="shimmer-table-header">
      <ShimmerBlock className="shimmer-th" style={{ flex: 2, height: 13 }} />
      <ShimmerBlock className="shimmer-th" style={{ flex: 2, height: 13 }} />
      <ShimmerBlock className="shimmer-th" style={{ flex: 1, height: 13 }} />
      <ShimmerBlock className="shimmer-th" style={{ width: 100, height: 13 }} />
    </div>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="shimmer-category-row">
        <ShimmerBlock className="shimmer-cat-icon" />
        <div className="shimmer-cat-lines">
          <ShimmerBlock className="shimmer-cat-name" />
          <ShimmerBlock className="shimmer-cat-slug" />
        </div>
        <ShimmerBlock className="shimmer-cat-desc" />
        <ShimmerBlock className="shimmer-cat-badge" />
        <div className="shimmer-cat-actions">
          <ShimmerBlock className="shimmer-cat-btn" />
          <ShimmerBlock className="shimmer-cat-btn" />
        </div>
      </div>
    ))}
  </div>
);

// ─── VideoSettings page skeleton ──────────────────────────────────────────────
export const ShimmerVideoSettings = () => (
  <div className="shimmer-page-wrapper" style={{ gap: 24 }}>
    {/* Header row */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ShimmerBlock style={{ width: 220, height: 22, borderRadius: 6 }} />
        <ShimmerBlock style={{ width: 300, height: 13, borderRadius: 4, opacity: 0.6 }} />
      </div>
      <ShimmerBlock style={{ width: 120, height: 36, borderRadius: 8 }} />
    </div>

    {/* Form card */}
    <div className="shimmer-form-card">
      <ShimmerBlock className="shimmer-form-title" />
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ShimmerBlock className="shimmer-form-label" />
          <ShimmerBlock className="shimmer-form-input" />
        </div>
      ))}
    </div>

    {/* Security toggles card */}
    <div className="shimmer-form-card">
      <ShimmerBlock className="shimmer-form-title" />
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f2f5' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <ShimmerBlock style={{ width: 180, height: 13, borderRadius: 4 }} />
            <ShimmerBlock style={{ width: 260, height: 11, borderRadius: 4, opacity: 0.6 }} />
          </div>
          <ShimmerBlock style={{ width: 48, height: 26, borderRadius: 20 }} />
        </div>
      ))}
    </div>
  </div>
);

export default {
  ShimmerBlock,
  ShimmerStatCard,
  ShimmerChartCard,
  ShimmerActivitySection,
  ShimmerDashboard,
  ShimmerUserDashboard,
  ShimmerCourseCard,
  ShimmerUserCourses,
  ShimmerAdminCourses,
  ShimmerVideoCard,
  ShimmerVideos,
  ShimmerNotificationRow,
  ShimmerNotifications,
  ShimmerPlanCard,
  ShimmerUserSubscriptions,
  ShimmerAdminSubscriptions,
  ShimmerTableRow,
  ShimmerUsers,
  ShimmerCategories,
  ShimmerVideoSettings,
};
