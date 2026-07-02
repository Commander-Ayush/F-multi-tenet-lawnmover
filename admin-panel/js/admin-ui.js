/* ============================
   GreenCut Admin Panel — UI logic
   ============================
   Everything here renders from JSON the backend returns — no
   server-rendered HTML anywhere. This file is shared by all three
   admin pages; each function no-ops cleanly if its elements aren't
   on the current page.
*/

/* =====================
   LOGIN PAGE
   ===================== */
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Already logged in? Skip straight past the login page.
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
      if (errorBox) { errorBox.textContent = '⚠️ ' + err.message; errorBox.style.display = 'flex'; }
      btn.disabled = false; btn.textContent = 'Sign in →';
    }
  });
}

function togglePassword() {
  const input = document.getElementById('password');
  const icon = document.getElementById('eyeIcon');
  if (input.type === 'password') { input.type = 'text'; icon.textContent = '🙈'; }
  else { input.type = 'password'; icon.textContent = '👁️'; }
}

/* =====================
   PANEL NAVIGATION (dashboard / bookings / sales / reviews — dashboard.html)
   ===================== */
function showPanel(id) {
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.style.display = 'block';

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
   DASHBOARD + BOOKINGS — fetched from one summary call
   ===================== */
let _allBookings = [];     // cached so the search filter doesn't need to refetch
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
    // Show pending badge on Reviews nav link
    const badge = document.getElementById('reviews-badge');
    if (badge) { badge.textContent = _pendingReviewCount; badge.style.display = _pendingReviewCount > 0 ? 'inline-flex' : 'none'; }
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
  // Initialise the revenue window display — defaults to "This Month"
  setRevenueWindow('1m');
}

// Called by the time-window toggle buttons in the sales panel
function setRevenueWindow(window) {
  const map = { '1m': _revenueWindows.rev1m, '3m': _revenueWindows.rev3m, '6m': _revenueWindows.rev6m, '12m': _revenueWindows.rev12m };
  const labels = { '1m': 'This Month', '3m': 'Last 3 Months', '6m': 'Last 6 Months', '12m': 'Last 12 Months' };
  setText('window-revenue', '$' + Math.round(map[window] || 0).toLocaleString());
  setText('window-label', labels[window] || '');
  // Highlight active toggle button
  document.querySelectorAll('.window-btn').forEach(b => b.classList.toggle('active', b.dataset.window === window));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderRecentBookings(recent) {
  const tbody = document.getElementById('recent-bookings-body');
  if (!tbody) return;
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:24px">No bookings yet</td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(req => `
    <tr>
      <td>${req.id}</td>
      <td>${escapeHtml(req.firstName + ' ' + req.lastName)}</td>
      <td>${escapeHtml(req.service || '')}</td>
      <td>${req.preferredDate || '-'}</td>
      <td>${statusBadge(req.completed)}</td>
    </tr>`).join('');
}

function statusBadge(completed) {
  return completed
    ? '<span class="status-badge completed">Completed</span>'
    : '<span class="status-badge pending">Pending</span>';
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookings-body');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:30px">No bookings yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(req => `
    <tr data-row data-search="${escapeHtml((req.firstName + ' ' + req.lastName + ' ' + (req.email || '') + ' ' + req.phone + ' ' + req.id).toLowerCase())}">
      <td><strong>${req.id}</strong></td>
      <td>${escapeHtml(req.firstName + ' ' + req.lastName)}<br/><small style="color:var(--text-light)">${escapeHtml(req.email || '')}</small></td>
      <td><a href="tel:${req.phone}">${escapeHtml(req.phone)}</a></td>
      <td>${escapeHtml(req.service || '')}</td>
      <td>${req.preferredDate || '-'}</td>
      <td>${req.submittedAt ? new Date(req.submittedAt).toLocaleString() : '-'}</td>
      <td>${statusBadge(req.completed)}</td>
      <td style="white-space:nowrap">
        ${req.completed
          ? `<button class="action-btn edit" onclick="handleReopen(${req.id})" title="Reopen">↺</button>`
          : `<button class="action-btn confirm" onclick="handleComplete(${req.id})" title="Mark complete">✓</button>`}
        <button class="action-btn delete" onclick="handleDelete(${req.id})" title="Delete">🗑</button>
      </td>
    </tr>`).join('');
}

async function handleComplete(id) {
  try { await AdminApi.completeBooking(id); await loadDashboard(); }
  catch (err) { alert(err.message); }
}
async function handleReopen(id) {
  try { await AdminApi.reopenBooking(id); await loadDashboard(); }
  catch (err) { alert(err.message); }
}
async function handleDelete(id) {
  if (!confirm('Delete this booking?')) return;
  try { await AdminApi.deleteBooking(id); await loadDashboard(); }
  catch (err) { alert(err.message); }
}

function filterBookings(query) {
  const tbody = document.getElementById('bookings-body');
  if (!tbody) return;
  const q = query.trim().toLowerCase();
  let visible = 0;
  tbody.querySelectorAll('tr[data-row]').forEach(row => {
    const match = !q || (row.dataset.search || '').includes(q);
    row.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const emptyRow = tbody.querySelector('tr[data-empty-state]');
  if (emptyRow) emptyRow.style.display = visible ? 'none' : '';
}

/* =====================
   SALES CHARTS — same drawing logic as before, sourced from
   _monthlyChart / _serviceBreakdown set by loadDashboard()
   ===================== */
function renderSalesCharts() {
  const months = _monthlyChart;
  const breakdown = _serviceBreakdown;

  const barChart = document.getElementById('bar-chart');
  if (barChart) {
    const maxRev = Math.max(...months.map(m => m.revenue), 1);
    barChart.innerHTML = months.map(m => {
      const pct = maxRev > 0 ? (m.revenue / maxRev) * 120 : 4;
      return `<div class="bar-wrap">
        <div class="bar" style="height:${Math.max(pct, 4)}px"><span class="tooltip">$${Math.round(m.revenue).toLocaleString()}</span></div>
        <div class="bar-label">${m.label}</div>
      </div>`;
    }).join('');
  }

  const volChart = document.getElementById('vol-chart');
  if (volChart) {
    const maxCnt = Math.max(...months.map(m => m.count), 1);
    volChart.innerHTML = months.map(m => {
      const pct = (m.count / maxCnt) * 120;
      return `<div class="bar-wrap">
        <div class="bar" style="height:${Math.max(pct, 4)}px;background:var(--green-dark)"><span class="tooltip">${m.count} booking${m.count === 1 ? '' : 's'}</span></div>
        <div class="bar-label">${m.label}</div>
      </div>`;
    }).join('');
  }

  const donutSvg = document.getElementById('donut-svg');
  const donutLegend = document.getElementById('donut-legend');
  if (donutSvg && donutLegend) {
    const entries = Object.entries(breakdown).slice(0, 6);
    const total = entries.reduce((a, [, cnt]) => a + cnt, 0) || 1;
    const colors = ['#2e7d32', '#4caf50', '#ff6f00', '#1976d2', '#7b1fa2', '#c62828'];
    const r = 52, cx = 64, cy = 64, circ = 2 * Math.PI * r;
    let offset = 0, paths = '';
    entries.forEach(([name, cnt], i) => {
      const pct = cnt / total;
      const dash = pct * circ, gap = circ - dash;
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="22"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset * circ}"/>`;
      offset += pct;
    });
    if (!entries.length) paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e0e0e0" stroke-width="22"/>`;
    donutSvg.innerHTML = `<svg width="128" height="128" viewBox="0 0 128 128">${paths}
      <text x="64" y="68" text-anchor="middle" font-size="13" fill="#1a5c2a" font-weight="700">${total} total</text></svg>`;
    donutLegend.innerHTML = entries.map(([name, cnt], i) =>
      `<div class="legend-item"><div class="legend-dot" style="background:${colors[i % colors.length]}"></div>
       <span>${escapeHtml(name.length > 24 ? name.slice(0, 22) + '…' : name)} (${cnt})</span></div>`
    ).join('') || '<div style="color:var(--text-light);font-size:.85rem">No bookings yet</div>';
  }
}

/* =====================
   SERVICES PAGE
   ===================== */
let _serviceCatalog = { services: [], plans: [], addons: [] };

async function loadServiceCatalog() {
  try {
    _serviceCatalog = await AdminApi.getServiceCatalog();
    renderCatalogSection('services-grid', _serviceCatalog.services || [], 'No services yet — add your first one above.');
    renderCatalogSection('plans-grid', _serviceCatalog.plans || [], 'No plans yet — add your first one above.', true);
    renderCatalogSection('addons-grid', _serviceCatalog.addons || [], 'No add-ons yet — add your first one above.');
  } catch (err) {
    console.error('service catalog load failed', err);
  }
}

function renderCatalogSection(containerId, items, emptyMsg, isPlan = false) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = `<div style="color:var(--text-light);padding:30px;text-align:center;grid-column:1/-1">${emptyMsg}</div>`;
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="service-admin-card" ${isPlan ? "style=\"border-left-color:var(--green-dark)\"" : ''}>
      <h4>${escapeHtml((item.icon ? item.icon + ' ' : '') + item.name)}${item.featured ? ' ⭐' : ''}</h4>
      <p style="font-size:.85rem;color:var(--text-light);margin:4px 0 8px">${escapeHtml(item.description || '')}</p>
      <div class="price-tag">${escapeHtml(item.price || '')}</div>
      <div class="actions">
        <button class="action-btn edit" onclick="openEditItemById(${item.id})">✏ Edit</button>
        <button class="action-btn delete" onclick="handleDeleteItem(${item.id})">🗑 Delete</button>
      </div>
    </div>`).join('');
}

async function handleDeleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try { await AdminApi.deleteServiceItem(id); await loadServiceCatalog(); }
  catch (err) { alert(err.message); }
}

function openAddItem(type) {
  document.getElementById('item-modal-title').textContent =
    type === 'plan' ? 'Add New Plan' : (type === 'addon' ? 'Add New Add-On' : 'Add New Service');
  document.getElementById('item-id-display').textContent = '';
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
  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-id-display').textContent = '#' + item.id;
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
  } catch (err) {
    alert(err.message);
  }
}

/* =====================
   REVIEWS PANEL — moderation queue
   ===================== */
let _allReviews = [];

async function loadReviews() {
  const tbody = document.getElementById('reviews-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:30px">Loading…</td></tr>`;
  try {
    _allReviews = await AdminApi.getReviews();
    renderReviewsTable(_allReviews);
  } catch (err) {
    console.error('reviews load failed', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:30px">Failed to load reviews.</td></tr>`;
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviews-body');
  if (!tbody) return;
  if (!reviews.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:30px">No reviews yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const statusBadgeHtml = r.approved
      ? '<span class="status-badge completed">Approved</span>'
      : '<span class="status-badge pending">Pending</span>';
    const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '-';
    return `
      <tr>
        <td>${escapeHtml(r.reviewerName)}<br/><small style="color:var(--text-light)">${escapeHtml(r.reviewerCity || '')}</small></td>
        <td style="color:#f9a825;letter-spacing:2px">${stars}</td>
        <td style="max-width:280px;font-size:.88rem">${escapeHtml(r.text)}</td>
        <td>${date}</td>
        <td>${statusBadgeHtml}</td>
        <td style="white-space:nowrap">
          ${!r.approved ? `<button class="action-btn confirm" onclick="handleApproveReview(${r.id})" title="Approve">✓ Approve</button>` : ''}
          <button class="action-btn delete" onclick="handleDeleteReview(${r.id})" title="Delete">🗑</button>
        </td>
      </tr>`;
  }).join('');
}

async function handleApproveReview(id) {
  try {
    await AdminApi.approveReview(id);
    await loadReviews();
    // Refresh badge count
    _pendingReviewCount = Math.max(0, _pendingReviewCount - 1);
    const badge = document.getElementById('reviews-badge');
    if (badge) { badge.textContent = _pendingReviewCount; badge.style.display = _pendingReviewCount > 0 ? 'inline-flex' : 'none'; }
  } catch (err) { alert(err.message); }
}

async function handleDeleteReview(id) {
  if (!confirm('Delete this review? This cannot be undone.')) return;
  try {
    const wasReview = _allReviews.find(r => r.id === id);
    await AdminApi.deleteReview(id);
    if (wasReview && !wasReview.approved) {
      _pendingReviewCount = Math.max(0, _pendingReviewCount - 1);
      const badge = document.getElementById('reviews-badge');
      if (badge) { badge.textContent = _pendingReviewCount; badge.style.display = _pendingReviewCount > 0 ? 'inline-flex' : 'none'; }
    }
    await loadReviews();
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
document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();

  // Pages other than login require a token up front
  const isLoginPage = !!document.getElementById('login-form');
  if (!isLoginPage && !getToken()) { goToLogin(); return; }

  // Mobile sidebar toggle
  const toggle = document.getElementById('sidebar-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => document.getElementById('admin-sidebar')?.classList.toggle('open'));
    if (window.innerWidth <= 768) toggle.style.display = 'block';
  }

  // Dashboard page wiring
  if (document.getElementById('panel-dashboard')) {
    document.querySelectorAll('.admin-nav a[data-panel]').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); showPanel(a.dataset.panel); });
    });
    showPanel('dashboard');
    loadDashboard();
  }

  const bSearch = document.getElementById('booking-search');
  if (bSearch) bSearch.addEventListener('input', () => filterBookings(bSearch.value));

  // Services page wiring
  if (document.getElementById('services-grid') && document.getElementById('item-form')) {
    loadServiceCatalog();
    document.getElementById('item-form').addEventListener('submit', submitItemForm);
  }

  // Logout button (present on every admin page's sidebar)
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => { AdminApi.logout(); location.href = 'login.html'; });
  }

  // Modal backdrop click to close
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });

  const dateEl = document.getElementById('admin-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
});
