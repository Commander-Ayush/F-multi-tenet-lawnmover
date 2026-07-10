/* ============================
   GreenCut Admin Panel — UI logic
   ============================
   Identical functionality to the original — only class names updated
   to match the redesigned markup. All API calls, IDs, and data flow
   are preserved exactly.
*/

/* ── Token helpers (keep in sync with admin-api.js) ── */
function getToken() { return localStorage.getItem('gc_admin_token'); }
function setToken(t) { localStorage.setItem('gc_admin_token', t); }
function clearToken() { localStorage.removeItem('gc_admin_token'); }
function goToLogin() { location.href = 'login.html'; }

/* =====================
   TOAST
   ===================== */
function showToast(msg) {
  const el = document.getElementById('gc-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

/* =====================
   LOGIN PAGE
   ===================== */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  if (getToken()) { location.href = 'dashboard.html'; return; }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.querySelector('.error-msg');
    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const { token } = await AdminApi.login(email, password);
      setToken(token);
      location.href = 'dashboard.html';
    } catch (err) {
      if (errorBox) { errorBox.textContent = err.message; errorBox.style.display = 'flex'; }
      btn.disabled = false; btn.textContent = 'Sign in →';
    }
  });
}

function togglePassword() {
  const input = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  const btn = icon.closest('button');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.innerHTML = isHidden
    ? '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.15 4.15M6.5 6.6C3.6 8.4 1.5 12 1.5 12s3.5 7 10.5 7c1.6 0 3-.3 4.25-.85"/><path d="M9.5 9.9a3.2 3.2 0 0 0 4.6 4.5"/>'
    : '<path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.2"/>';
  if (btn) btn.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
}

/* =====================
   PANEL NAVIGATION
   ===================== */
function showPanel(id) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.admin-nav a[data-panel]').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.admin-nav a[data-panel="${id}"]`);
  if (link) link.classList.add('active');

  const titles = { dashboard: 'Dashboard', bookings: 'Bookings', sales: 'Sales Analytics', reviews: 'Review Moderation' };
  const titleEl = document.getElementById('panel-title');
  if (titleEl) titleEl.textContent = titles[id] || 'Admin';

  if (id === 'sales') renderSalesCharts();
  if (id === 'reviews') loadReviews();
}

/* =====================
   DASHBOARD DATA
   ===================== */
let _allBookings = [];
let _monthlyChart = [];
let _serviceBreakdown = {};
let _revenueWindows = { rev1m: 0, rev3m: 0, rev6m: 0, rev12m: 0 };
let _pendingReviewCount = 0;

async function loadDashboard() {
  try {
    const summary = await AdminApi.getDashboardSummary();
    renderDashboardStats(summary);
    _monthlyChart = summary.monthlyChart || [];
    _serviceBreakdown = summary.serviceBreakdown || {};
    _revenueWindows = { rev1m: summary.rev1m || 0, rev3m: summary.rev3m || 0, rev6m: summary.rev6m || 0, rev12m: summary.rev12m || 0 };
    _pendingReviewCount = summary.pendingReviewCount || 0;
    renderRecentBookings(summary.recentRequests || []);

    const badge = document.getElementById('reviews-badge');
    if (badge) {
      badge.textContent = _pendingReviewCount;
      badge.style.display = _pendingReviewCount > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error('dashboard summary failed', err);
  }

  try {
    _allBookings = await AdminApi.getBookings();
    renderBookingsTable(_allBookings);
  } catch (err) {
    console.error('bookings load failed', err);
  }
}

function renderDashboardStats(s) {
  setText('dash-total-bookings', s.totalRequests);
  setText('dash-month-bookings', s.monthBookings);
  setText('dash-pending', s.pending);
  setText('dash-revenue', '$' + Math.round(s.totalRevenue).toLocaleString());
  setText('dash-month-revenue', '$' + Math.round(s.monthRevenue).toLocaleString() + ' this month');
  setText('dash-svc-count', s.activeServiceCount);
  setText('dash-complete-rate', Math.round(s.completionRate) + '%');
  setText('dash-avg-job', '$' + Math.round(s.avgJobValue).toLocaleString());
  setText('yearly-revenue', '$' + Math.round(s.yearRevenue).toLocaleString());
  setText('yearly-bookings', s.yearBookings);
  setText('current-year-label', s.currentYearLabel);
  setRevenueWindow('1m');
}

function setRevenueWindow(window) {
  const map = { '1m': _revenueWindows.rev1m, '3m': _revenueWindows.rev3m, '6m': _revenueWindows.rev6m, '12m': _revenueWindows.rev12m };
  const labels = { '1m': 'This Month', '3m': 'Last 3 Months', '6m': 'Last 6 Months', '12m': 'Last 12 Months' };
  setText('window-revenue', '$' + Math.round(map[window] || 0).toLocaleString());
  setText('window-label', labels[window] || '');
  document.querySelectorAll('.window-btn').forEach(b => b.classList.toggle('active', b.dataset.window === window));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ─ Recent Bookings ─ */
function renderRecentBookings(recent) {
  const tbody = document.getElementById('recent-bookings-body');
  if (!tbody) return;
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--ink-400);padding:32px">No bookings yet</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(req => `
    <tr>
      <td><strong>#${req.id}</strong></td>
      <td>${escapeHtml(req.firstName + ' ' + req.lastName)}</td>
      <td>${escapeHtml(req.service || '—')}</td>
      <td>${req.preferredDate || '—'}</td>
      <td>${statusBadge(req.completed)}</td>
    </tr>`).join('');
}

function statusBadge(completed) {
  return completed
    ? '<span class="badge completed">Completed</span>'
    : '<span class="badge pending">Pending</span>';
}

/* ─ All Bookings ─ */
function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookings-body');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-400);padding:40px">No bookings yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(req => `
    <tr data-row data-search="${escapeHtml((req.firstName + ' ' + req.lastName + ' ' + (req.email || '') + ' ' + req.phone + ' ' + req.id).toLowerCase())}">
      <td><strong>#${req.id}</strong></td>
      <td>${escapeHtml(req.firstName + ' ' + req.lastName)}<br/><small>${escapeHtml(req.email || '')}</small></td>
      <td><a href="tel:${req.phone}">${escapeHtml(req.phone)}</a></td>
      <td>${escapeHtml(req.service || '—')}</td>
      <td>${req.preferredDate || '—'}</td>
      <td>${req.submittedAt ? new Date(req.submittedAt).toLocaleString() : '—'}</td>
      <td>${statusBadge(req.completed)}</td>
      <td style="white-space:nowrap">
        ${req.completed
      ? `<button class="action-btn reopen" onclick="handleReopen(${req.id})" title="Reopen">↺ Reopen</button>`
      : `<button class="action-btn confirm" onclick="handleComplete(${req.id})" title="Mark complete">✓ Done</button>`}
        <button class="action-btn delete" onclick="handleDelete(${req.id})" title="Delete">Delete</button>
      </td>
    </tr>`).join('');
}

async function handleComplete(id) {
  const row = document.querySelector(`button.confirm[onclick="handleComplete(${id})"]`)?.closest('tr');
  if (row) {
    row.querySelector('td:nth-last-child(2)').innerHTML = '<span class="badge completing"><span class="badge-spinner">↻</span>Completing…</span>';
    row.querySelector('td:last-child').innerHTML = '<button class="action-btn delete" onclick="handleDelete(' + id + ')">Delete</button>';
  }
  try {
    await AdminApi.completeBooking(id);
    await loadDashboard();
    showToast('Booking marked complete.');
  } catch (err) {
    await loadDashboard();
    alert(err.message);
  }
}

async function handleReopen(id) {
  const row = document.querySelector(`button.reopen[onclick="handleReopen(${id})"]`)?.closest('tr');
  if (row) {
    row.querySelector('td:nth-last-child(2)').innerHTML = '<span class="badge reopening"><span class="badge-spinner">↻</span>Reopening…</span>';
    row.querySelector('td:last-child').innerHTML = '<button class="action-btn delete" onclick="handleDelete(' + id + ')">Delete</button>';
  }
  try {
    await AdminApi.reopenBooking(id);
    await loadDashboard();
    showToast('Booking reopened.');
  } catch (err) {
    await loadDashboard();
    alert(err.message);
  }
}
let _pendingDeleteId = null;

function openDeleteModal(id) {
  _pendingDeleteId = id;
  const modal = document.getElementById('delete-modal');
  modal.style.display = 'flex';
  document.getElementById('delete-confirm-btn').onclick = confirmDelete;
}

function closeDeleteModal() {
  _pendingDeleteId = null;
  document.getElementById('delete-modal').style.display = 'none';
  const btn = document.getElementById('delete-confirm-btn');
  if (btn) { btn.disabled = false; btn.innerHTML = 'Delete'; }
}

async function confirmDelete() {
  const id = _pendingDeleteId;
  if (!id) return;
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="badge-spinner">↻</span> Deleting…';
  try {
    await AdminApi.deleteBooking(id);
    closeDeleteModal();
    await loadDashboard();
    showToast('Booking deleted.');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = 'Delete';
    alert(err.message);
  }
}

async function handleDelete(id) {
  openDeleteModal(id);
}

function filterBookings(query) {
  const tbody = document.getElementById('bookings-body');
  if (!tbody) return;
  const q = query.trim().toLowerCase();
  tbody.querySelectorAll('tr[data-row]').forEach(row => {
    row.style.display = !q || (row.dataset.search || '').includes(q) ? '' : 'none';
  });
}

/* =====================
   SALES CHARTS
   ===================== */
const PALETTE = ['#1B4332', '#2D6A4F', '#4A7C59', '#6B9A76', '#7C3AED', '#D97706'];

function renderSalesCharts() {
  const months = _monthlyChart;
  const breakdown = _serviceBreakdown;

  /* Revenue bars */
  const barChart = document.getElementById('bar-chart');
  if (barChart) {
    const maxRev = Math.max(...months.map(m => m.revenue), 1);
    barChart.innerHTML = months.map(m => {
      const pct = (m.revenue / maxRev) * 110;
      return `<div class="bar-wrap">
        <div class="bar" style="height:${Math.max(pct, 4)}px">
          <span class="tooltip">$${Math.round(m.revenue).toLocaleString()}</span>
        </div>
        <div class="bar-label">${m.label}</div>
      </div>`;
    }).join('') || '<div style="color:var(--ink-400);font-size:12.5px;text-align:center;width:100%">No data yet</div>';
  }

  /* Volume bars */
  const volChart = document.getElementById('vol-chart');
  if (volChart) {
    const maxCnt = Math.max(...months.map(m => m.count), 1);
    volChart.innerHTML = months.map(m => {
      const pct = (m.count / maxCnt) * 110;
      return `<div class="bar-wrap">
        <div class="bar bar-vol" style="height:${Math.max(pct, 4)}px">
          <span class="tooltip">${m.count} booking${m.count === 1 ? '' : 's'}</span>
        </div>
        <div class="bar-label">${m.label}</div>
      </div>`;
    }).join('') || '<div style="color:var(--ink-400);font-size:12.5px;text-align:center;width:100%">No data yet</div>';
  }

  /* Donut */
  const donutSvg = document.getElementById('donut-svg');
  const donutLegend = document.getElementById('donut-legend');
  if (donutSvg && donutLegend) {
    const entries = Object.entries(breakdown).slice(0, 6);
    const total = entries.reduce((a, [, cnt]) => a + cnt, 0) || 1;
    const r = 52, cx = 64, cy = 64, circ = 2 * Math.PI * r;
    let offset = 0, paths = '';
    entries.forEach(([, cnt], i) => {
      const pct = cnt / total;
      const dash = pct * circ, gap = circ - dash;
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="22"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * circ}"/>`;
      offset += pct;
    });
    if (!entries.length) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="22"/>`;
    donutSvg.innerHTML = `<svg width="128" height="128" viewBox="0 0 128 128">${paths}
      <text x="64" y="64" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="var(--ink-900)" font-weight="600" font-family="Inter">${total}</text>
      <text x="64" y="77" text-anchor="middle" font-size="9.5" fill="var(--ink-400)" font-family="Inter">bookings</text>
    </svg>`;
    donutLegend.innerHTML = entries.map(([name, cnt], i) =>
      `<div class="legend-item">
        <div class="legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></div>
        <span>${escapeHtml(name.length > 26 ? name.slice(0, 24) + '…' : name)} (${cnt})</span>
      </div>`
    ).join('') || '<div style="color:var(--ink-400);font-size:12.5px">No bookings yet</div>';
  }
}

/* =====================
   SERVICES PAGE
   ===================== */
let _serviceCatalog = { services: [], plans: [], addons: [] };

async function loadServiceCatalog() {
  try {
    _serviceCatalog = await AdminApi.getServiceCatalog();
    renderCatalogSection('services-grid', _serviceCatalog.services || [], 'service', 'No services yet — add your first one above.');
    renderCatalogSection('plans-grid', _serviceCatalog.plans || [], 'plan', 'No plans yet — add your first one above.');
    renderCatalogSection('addons-grid', _serviceCatalog.addons || [], 'addon', 'No add-ons yet — add your first one above.');
  } catch (err) {
    console.error('service catalog load failed', err);
  }
}

function renderCatalogSection(containerId, items, accentType, emptyMsg) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div class="catalog-empty">${emptyMsg}</div>`;
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="catalog-card">
      <div class="catalog-card-accent ${accentType}"></div>
      <div class="catalog-card-name">
        ${item.icon ? escapeHtml(item.icon) + ' ' : ''}${escapeHtml(item.name)}
        ${item.featured ? '<span class="catalog-card-featured">Most Popular</span>' : ''}
      </div>
      <div class="catalog-card-desc">${escapeHtml(item.description || '')}</div>
      <div class="catalog-card-price">${escapeHtml(item.price || '')}</div>
      <div class="catalog-card-actions">
        <button class="action-btn edit"   onclick="openEditItemById(${item.id})">Edit</button>
        <button class="action-btn delete" onclick="handleDeleteItem(${item.id})">Delete</button>
      </div>
    </div>`).join('');
}

async function handleDeleteItem(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try { await AdminApi.deleteServiceItem(id); await loadServiceCatalog(); showToast('Item deleted.'); }
  catch (err) { alert(err.message); }
}

function openAddItem(type) {
  const labels = { service: 'New Service', plan: 'New Plan', addon: 'New Add-On' };
  setText('item-modal-eyebrow', 'Create');
  setText('item-modal-title', labels[type] || 'New Item');
  document.getElementById('item-form').reset();
  document.getElementById('item-type-hidden').value = type;
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-modal').classList.add('open');
}

function openEditItemById(id) {
  const all = [..._serviceCatalog.services, ..._serviceCatalog.plans, ..._serviceCatalog.addons];
  const item = all.find(i => i.id === id);
  if (!item) { alert('Could not find that item — try refreshing.'); return; }
  openEditItem(item);
}

function openEditItem(item) {
  setText('item-modal-eyebrow', 'Edit  #' + item.id);
  setText('item-modal-title', 'Edit Item');
  document.getElementById('item-icon').value = item.icon || '';
  document.getElementById('item-name').value = item.name || '';
  document.getElementById('item-price').value = item.price || '';
  document.getElementById('item-description').value = item.description || '';
  document.getElementById('item-featured').checked = !!item.featured;
  document.getElementById('item-type-hidden').value = item.type || 'service';
  document.getElementById('item-edit-id').value = item.id;
  document.getElementById('item-modal').classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

async function submitItemForm(e) {
  e.preventDefault();
  const editId = document.getElementById('item-edit-id').value;
  const payload = {
    icon: document.getElementById('item-icon').value,
    name: document.getElementById('item-name').value,
    price: document.getElementById('item-price').value,
    description: document.getElementById('item-description').value,
    featured: document.getElementById('item-featured').checked,
    type: document.getElementById('item-type-hidden').value,
  };
  try {
    if (editId) await AdminApi.editServiceItem(editId, payload);
    else await AdminApi.addServiceItem(payload);
    closeModal('item-modal');
    await loadServiceCatalog();
    showToast(editId ? 'Item updated.' : 'Item added.');
  } catch (err) { alert(err.message); }
}

/* =====================
    REVIEWS PANEL
   ===================== */
let _allReviews = [];

async function loadReviews() {
  const tbody = document.getElementById('reviews-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-400);padding:40px">Loading…</td></tr>`;
  try {
    _allReviews = await AdminApi.getReviews();
    renderReviewsTable(_allReviews);
  } catch (err) {
    console.error('reviews load failed', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-400);padding:40px">Failed to load reviews.</td></tr>`;
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviews-body');
  if (!tbody) return;
  if (!reviews.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--ink-400);padding:40px">No reviews yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—';
    return `
      <tr>
        <td>${escapeHtml(r.reviewerName)}<br/><small>${escapeHtml(r.reviewerCity || '')}</small></td>
        <td style="color:#D97706;letter-spacing:2px;font-size:14px">${stars}</td>
        <td style="max-width:260px;font-size:12.5px;line-height:1.5">${escapeHtml(r.text)}</td>
        <td>${date}</td>
        <td>${r.approved
        ? '<span class="badge approved">Approved</span>'
        : '<span class="badge pending">Pending</span>'}</td>
        <td style="white-space:nowrap">
          ${!r.approved ? `<button class="action-btn confirm" onclick="handleApproveReview(${r.id})">✓ Approve</button>` : ''}
          <button class="action-btn delete" onclick="handleDeleteReview(${r.id})">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

async function handleApproveReview(id) {
  try {
    await AdminApi.approveReview(id);
    await loadReviews();
    _pendingReviewCount = Math.max(0, _pendingReviewCount - 1);
    const badge = document.getElementById('reviews-badge');
    if (badge) { badge.textContent = _pendingReviewCount; badge.style.display = _pendingReviewCount > 0 ? 'inline-block' : 'none'; }
    showToast('Review approved and published.');
  } catch (err) { alert(err.message); }
}

async function handleDeleteReview(id) {
  if (!confirm('Delete this review? This cannot be undone.')) return;
  try {
    const was = _allReviews.find(r => r.id === id);
    await AdminApi.deleteReview(id);
    if (was && !was.approved) {
      _pendingReviewCount = Math.max(0, _pendingReviewCount - 1);
      const badge = document.getElementById('reviews-badge');
      if (badge) { badge.textContent = _pendingReviewCount; badge.style.display = _pendingReviewCount > 0 ? 'inline-block' : 'none'; }
    }
    await loadReviews();
    showToast('Review deleted.');
  } catch (err) { alert(err.message); }
}

/* =====================
   SHARED HELPERS
   ===================== */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* =====================
   INIT
   ===================== */
document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
});