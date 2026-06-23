export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://lms-backend-vert-alpha.vercel.app';
export const BASE_URL = API_BASE_URL;

export const AUTH_ENDPOINTS = {
  LOGIN_USER: `${API_BASE_URL}/api/users/login`,
  REGISTER_USER: `${API_BASE_URL}/api/users/register`,
  FORGOT_PASSWORD: `${API_BASE_URL}/api/users/forgot-password`,
  RESET_PASSWORD: (token) => `${API_BASE_URL}/api/users/reset-password/${token}`,
  PROFILE: `${API_BASE_URL}/api/users/profile`,
  LOGOUT: `${API_BASE_URL}/api/users/logout`,
};

export const ADMIN_ENDPOINTS = {
  LOGIN_ADMIN: `${API_BASE_URL}/api/admin/login`,
  PROFILE_ADMIN: `${API_BASE_URL}/api/admin/profile`,
  DASHBOARD: `${API_BASE_URL}/api/admin/dashboard`,
  USERS: `${API_BASE_URL}/api/admin/users`,
  USER_DETAIL: (id) => `${API_BASE_URL}/api/admin/users/${id}`,
  USER_STATUS: (id) => `${API_BASE_URL}/api/admin/users/${id}/status`,
  USER_ACTIVITY: (id) => `${API_BASE_URL}/api/admin/users/${id}/activity`,
  USER_COURSES: (id) => `${API_BASE_URL}/api/admin/users/${id}/courses`,
  USER_DEVICE_LIMIT: (id) => `${API_BASE_URL}/api/admin/users/${id}/device-limit`,
  USER_FORCE_LOGOUT: (id) => `${API_BASE_URL}/api/admin/users/${id}/force-logout`,
};

export const CATEGORY_ENDPOINTS = {
  LIST: `${API_BASE_URL}/api/categories`,
  CREATE: `${API_BASE_URL}/api/categories`,
  UPDATE: (id) => `${API_BASE_URL}/api/categories/${id}`,
  DELETE: (id) => `${API_BASE_URL}/api/categories/${id}`,
};

export const COURSE_ENDPOINTS = {
  LIST: `${API_BASE_URL}/api/courses`,
  MY_COURSES: `${API_BASE_URL}/api/courses/my-courses`,
  CREATE: `${API_BASE_URL}/api/courses`,
  UPDATE: (id) => `${API_BASE_URL}/api/courses/${id}`,
  DELETE: (id) => `${API_BASE_URL}/api/courses/${id}`,
  GET: (id) => `${API_BASE_URL}/api/courses/${id}`,
  ACCESS: (id) => `${API_BASE_URL}/api/courses/${id}/access`,
  REORDER: (id) => `${API_BASE_URL}/api/courses/${id}/reorder`,
};

export const VIDEO_ENDPOINTS = {
  LIST: `${API_BASE_URL}/api/videos`,
  CREATE: `${API_BASE_URL}/api/videos`,
  GET: (id) => `${API_BASE_URL}/api/videos/${id}`,
  UPDATE: (id) => `${API_BASE_URL}/api/videos/${id}`,
  DELETE: (id) => `${API_BASE_URL}/api/videos/${id}`,
  GET_STREAM_TOKEN: (id) => `${API_BASE_URL}/api/videos/${id}/token`,
  STREAM: (token) => `${API_BASE_URL}/api/videos/stream/${token}`,
  SECURITY: (id) => `${API_BASE_URL}/api/videos/${id}/security`,
  UPDATE_SECURITY: (id) => `${API_BASE_URL}/api/videos/${id}/security`,
  BY_COURSE: (courseId) => `${API_BASE_URL}/api/videos/course/${courseId}`,
};

export const UPLOAD_ENDPOINT = `${API_BASE_URL}/api/upload`;

// ── Notification endpoints ─────────────────────────────────────────────────────
export const NOTIFICATION_ENDPOINTS = {
  MY: `${API_BASE_URL}/api/notifications/me`,
  MARK_READ: `${API_BASE_URL}/api/notifications/read`,
  ADMIN_LIST: (params) => `${API_BASE_URL}/api/notifications/admin?${params}`,
  BROADCAST: `${API_BASE_URL}/api/notifications/broadcast`,
  NEW_CONTENT: `${API_BASE_URL}/api/notifications/new-content`,
  EXPIRY_REMINDER: `${API_BASE_URL}/api/notifications/expiry-reminder`,
};

// ── Progress endpoints ─────────────────────────────────────────────────────────
export const PROGRESS_ENDPOINTS = {
  ADMIN_LIST: (params) => `${API_BASE_URL}/api/progress/admin?${params}`,
  ADMIN_COURSE: (courseId) => `${API_BASE_URL}/api/progress/admin/courses/${courseId}`,
};

// ── Subscription endpoints ─────────────────────────────────────────────────────
export const SUBSCRIPTION_ENDPOINTS = {
  // Public (no auth)
  PUBLIC: `${API_BASE_URL}/api/subscriptions/public`,

  // User (auth required)
  MY_SUBSCRIPTION: `${API_BASE_URL}/api/subscriptions/me`,
  PURCHASE: `${API_BASE_URL}/api/subscriptions/purchase`,
  VALIDATE_COUPON: `${API_BASE_URL}/api/subscriptions/coupons/validate`,

  // Admin only
  SETTINGS: `${API_BASE_URL}/api/subscriptions/settings`,
  UPDATE_SETTINGS: `${API_BASE_URL}/api/subscriptions/settings`,
  CREATE_PLAN: `${API_BASE_URL}/api/subscriptions/plans`,
  UPDATE_PLAN: (planId) => `${API_BASE_URL}/api/subscriptions/plans/${planId}`,
  DELETE_PLAN: (planId) => `${API_BASE_URL}/api/subscriptions/plans/${planId}`,
  CREATE_COUPON: `${API_BASE_URL}/api/subscriptions/coupons`,
  DELETE_COUPON: (code) => `${API_BASE_URL}/api/subscriptions/coupons/${code}`,
  PAYMENTS: `${API_BASE_URL}/api/subscriptions/payments`,
  REFUND: (txnId) => `${API_BASE_URL}/api/subscriptions/payments/${txnId}/refund`,
  UPDATE_USER_SUBSCRIPTION: (userId) => `${API_BASE_URL}/api/subscriptions/users/${userId}`,
};

// ── Analytics endpoints ────────────────────────────────────────────────────────
export const ANALYTICS_ENDPOINTS = {
  OVERVIEW: `${API_BASE_URL}/api/analytics/overview`,
  USERS: `${API_BASE_URL}/api/analytics/users`,
  COURSES: `${API_BASE_URL}/api/analytics/courses`,
  REVENUE: `${API_BASE_URL}/api/analytics/revenue`,
  VIDEOS: `${API_BASE_URL}/api/analytics/videos`,
};

// ── Reports endpoints ──────────────────────────────────────────────────────────
export const REPORTS_ENDPOINTS = {
  USERS: `${API_BASE_URL}/api/reports/users`,
  REVENUE: `${API_BASE_URL}/api/reports/revenue`,
  COURSES: `${API_BASE_URL}/api/reports/courses`,
  MONTHLY_REVENUE: `${API_BASE_URL}/api/reports/monthly-revenue`,
  ACTIVE_STUDENTS: `${API_BASE_URL}/api/reports/active-students`,
  COURSE_PERFORMANCE: `${API_BASE_URL}/api/reports/course-performance`,
  CATEGORIES: `${API_BASE_URL}/api/reports/categories`,
  PLANS: `${API_BASE_URL}/api/reports/plans`,
};

// ── Helpers ────────────────────────────────────────────────────────────────────
export const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
});

export const verifyCourseAccess = async (courseId, authToken) => {
  try {
    const accessRes = await fetch(COURSE_ENDPOINTS.ACCESS(courseId), {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (accessRes.ok) {
      const data = await accessRes.json().catch(() => ({}));
      return {
        hasAccess: data.success && data.hasAccess,
        course: data.data || null,
        message: data.message || '',
      };
    }

    if (accessRes.status === 403) {
      const data = await accessRes.json().catch(() => ({}));
      return {
        hasAccess: false,
        course: null,
        message: data.message || 'You do not have access to this course.',
      };
    }

    const [courseRes, profileRes] = await Promise.all([
      fetch(COURSE_ENDPOINTS.GET(courseId), { headers: { Authorization: `Bearer ${authToken}` } }),
      fetch(AUTH_ENDPOINTS.PROFILE, { headers: { Authorization: `Bearer ${authToken}` } }),
    ]);

    const courseData = await courseRes.json().catch(() => ({}));
    const profileData = await profileRes.json().catch(() => ({}));

    if (!courseRes.ok || !courseData.success || !courseData.data)
      return { hasAccess: false, course: null, message: 'Course not found.' };

    const course = courseData.data;
    const user = profileData.data;

    if (!user)
      return { hasAccess: false, course: null, message: 'Could not verify your account. Please log in again.' };

    if (user?.role === 'admin') return { hasAccess: true, course, message: '' };

    const userCourses = (user?.courses || []).map((c) => c.toString());
    const hasAccess =
      userCourses.includes(course._id) ||
      userCourses.includes(course._id?.toString()) ||
      userCourses.includes(course.title);

    return {
      hasAccess,
      course: hasAccess ? course : null,
      message: hasAccess
        ? ''
        : 'You do not have access to this course. Please contact your administrator.',
    };
  } catch (err) {
    console.error('verifyCourseAccess error:', err);
    return {
      hasAccess: false,
      course: null,
      message: 'Unable to verify course access. Please check your connection and try again.',
    };
  }
};

export const fetchSecureStreamUrl = async (videoId, authToken) => {
  const res = await fetch(VIDEO_ENDPOINTS.GET_STREAM_TOKEN(videoId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to obtain stream token');
  }
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Stream token request failed');

  // S3 presigned URLs are absolute (start with https://).
  // Legacy local-proxy tokens are relative paths — prefix with API_BASE_URL.
  const streamUrl = data.streamUrl.startsWith('http')
    ? data.streamUrl
    : `${API_BASE_URL}${data.streamUrl}`;

  return {
    streamUrl,
    isHLS: data.isHLS || false,   // true → use HLS.js, false → plain <video src>
    security: data.security,
    expiresIn: data.expiresIn,
  };
};