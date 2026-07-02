/* ============================
   GreenCut Admin Panel — API layer
   ============================
   One central admin panel serves EVERY client — there's no per-business
   copy of this app. The login endpoint identifies which business an
   admin belongs to and bakes that into the JWT; every request after
   that just carries the token. Domain/Origin is never used here.
*/

const API_BASE = "http://localhost:8080"; // ← same backend address as the storefront

function getToken() {
  return localStorage.getItem('gc_admin_token');
}

function setToken(token) {
  localStorage.setItem('gc_admin_token', token);
}

function clearToken() {
  localStorage.removeItem('gc_admin_token');
}

function goToLogin() {
  clearToken();
  if (!location.pathname.endsWith('login.html')) {
    location.href = 'login.html';
  }
}

async function authedRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    goToLogin();
    throw new Error('Not logged in');
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': 'Bearer ' + token,
    },
  });

  if (res.status === 401) {
    // token missing/expired/invalid — bounce back to login
    goToLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) message = errBody.message;
    } catch (_) { /* not JSON */ }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function authedGet(path) {
  return authedRequest(path, { method: 'GET' });
}

async function authedSend(method, path, body) {
  return authedRequest(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const AdminApi = {
  // POST /auth/login   body: { email, password }  ->  { token }
  // (not authed — this is how you GET a token in the first place)
  login: async (email, password) => {
    const res = await fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(res.status === 401 ? 'Incorrect email or password' : `Login failed: ${res.status}`);
    return res.json();
  },

  logout: () => { clearToken(); },

  // GET /admin/dashboard/summary -> see CONTRACT.md for full shape
  getDashboardSummary: () => authedGet('/admin/dashboard/summary'),

  // GET /admin/bookings -> [ BookingDto, ... ]
  getBookings: () => authedGet('/admin/bookings'),
  completeBooking: (id) => authedSend('POST', `/admin/bookings/${id}/complete`),
  reopenBooking:   (id) => authedSend('POST', `/admin/bookings/${id}/reopen`),
  deleteBooking:   (id) => authedSend('DELETE', `/admin/bookings/${id}`),

  // GET /admin/services -> { services: [...], plans: [...], addons: [...] }
  getServiceCatalog: () => authedGet('/admin/services'),
  addServiceItem:    (payload) => authedSend('POST', '/admin/services', payload),
  editServiceItem:   (id, payload) => authedSend('PUT', `/admin/services/${id}`, payload),
  deleteServiceItem: (id) => authedSend('DELETE', `/admin/services/${id}`),

  // POST /admin/account/password  body: { currentPassword, newPassword }
  changePassword: (currentPassword, newPassword) =>
    authedSend('POST', '/admin/account/password', { currentPassword, newPassword }),

  // GET /admin/reviews -> [ ReviewDto, ... ] (all: pending + approved)
  getReviews: () => authedGet('/admin/reviews'),
  approveReview: (id) => authedSend('POST', `/admin/reviews/${id}/approve`),
  deleteReview:  (id) => authedSend('DELETE', `/admin/reviews/${id}`),
};
