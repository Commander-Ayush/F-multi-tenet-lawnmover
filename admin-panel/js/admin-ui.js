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

  const titles = { dashboard: 'Dashboard', bookings: 'Bookings', orders: 'Orders', sales: 'Sales Analytics', reviews: 'Review Moderation' };
  const titleEl = document.getElementById('panel-title');
  if (titleEl) titleEl.textContent = titles[id] || 'Admin';

  if (id === 'sales') renderSalesCharts();
  if (id === 'reviews') loadReviews();
  if (id === 'orders') loadOrders();
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
  try { await AdminApi.completeBooking(id); await loadDashboard(); showToast('Booking marked complete.'); }
  catch (err) { alert(err.message); }
}
async function handleReopen(id) {
  try { await AdminApi.reopenBooking(id); await loadDashboard(); showToast('Booking reopened.'); }
  catch (err) { alert(err.message); }
}
async function handleDelete(id) {
  if (!confirm('Delete this booking? This cannot be undone.')) return;
  try { await AdminApi.deleteBooking(id); await loadDashboard(); showToast('Booking deleted.'); }
  catch (err) { alert(err.message); }
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
   ORDERS PANEL (equipment purchase requests)
   ===================== */
let _allOrders = [];

async function loadOrders() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--ink-400);padding:40px">Loading…</td></tr>`;
  try {
    _allOrders = await AdminApi.getOrders();
    renderOrdersTable(_allOrders);

    const pendingCount = _allOrders.filter(o => !o.completed).length;
    const badge = document.getElementById('orders-badge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.error('orders load failed', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--ink-400);padding:40px">Failed to load orders.</td></tr>`;
  }
}

function summarizeOrderItems(order) {
  const items = order.items || [];
  if (!items.length) return '—';
  const first = items[0];
  const label = `${escapeHtml(first.productName || first.name || 'Item')} × ${first.quantity}`;
  return items.length > 1 ? `${label} <small>+${items.length - 1} more</small>` : label;
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  if (!orders.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--ink-400);padding:40px">No orders yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr data-row data-search="${escapeHtml((o.firstName + ' ' + o.lastName + ' ' + (o.email || '') + ' ' + o.phone + ' ' + o.id).toLowerCase())}">
      <td><strong>#${o.id}</strong></td>
      <td>${escapeHtml(o.firstName + ' ' + o.lastName)}<br/><small>${escapeHtml(o.email || '')}</small></td>
      <td><a href="tel:${o.phone}">${escapeHtml(o.phone)}</a></td>
      <td style="max-width:220px">${summarizeOrderItems(o)}</td>
      <td>${o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}${o.fulfillment === 'delivery' && o.address ? `<br/><small>${escapeHtml(o.address)}</small>` : ''}</td>
      <td>${o.preferredDate || '—'}</td>
      <td>${o.submittedAt ? new Date(o.submittedAt).toLocaleString() : '—'}</td>
      <td>${statusBadge(o.completed)}</td>
      <td style="white-space:nowrap">
        ${o.completed
      ? `<button class="action-btn reopen" onclick="handleReopenOrder(${o.id})" title="Reopen">↺ Reopen</button>`
      : `<button class="action-btn confirm" onclick="handleFulfillOrder(${o.id})" title="Mark fulfilled">✓ Fulfilled</button>`}
        <button class="action-btn delete" onclick="handleDeleteOrder(${o.id})" title="Delete">Delete</button>
      </td>
    </tr>`).join('');
}

async function handleFulfillOrder(id) {
  try { await AdminApi.fulfillOrder(id); await loadOrders(); showToast('Order marked fulfilled.'); }
  catch (err) { alert(err.message); }
}
async function handleReopenOrder(id) {
  try { await AdminApi.reopenOrder(id); await loadOrders(); showToast('Order reopened.'); }
  catch (err) { alert(err.message); }
}
async function handleDeleteOrder(id) {
  // Routes straight to the modal workflow instead of using confirm()
  requestDeletion('order', id, false);
}

function filterOrders(query) {
  const tbody = document.getElementById('orders-body');
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
   PRODUCTS PAGE (Shop & Products)
   ===================== */
const PRODUCT_CATEGORY_LABELS = {
  'push-mower': 'Push Mowers',
  'riding-mower': 'Riding Mowers',
  'robotic-mower': 'Robotic Mowers',
  'trimmer': 'Trimmers & Edgers',
  'blower': 'Blowers & Vacuums',
  'accessory': 'Parts & Accessories',
};

let _productCatalog = [];
let _activeProductCategory = 'all';

async function loadProductCatalog() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  try {
    _productCatalog = await AdminApi.getProducts();
    renderProductCategoryChips();
    renderProductGrid();
  } catch (err) {
    console.error('product catalog load failed', err);
    grid.innerHTML = '<div class="catalog-empty">Failed to load products.</div>';
  }
}

function renderProductCategoryChips() {
  const wrap = document.getElementById('product-category-filters');
  if (!wrap) return;
  const present = new Set(_productCatalog.map(p => p.category));
  const chips = [{ key: 'all', label: 'All Products' }]
    .concat(Object.keys(PRODUCT_CATEGORY_LABELS).filter(k => present.has(k)).map(k => ({ key: k, label: PRODUCT_CATEGORY_LABELS[k] })));

  wrap.innerHTML = chips.map(c =>
    `<button type="button" class="chip-filter ${c.key === _activeProductCategory ? 'active' : ''}" data-category="${c.key}">${c.label}</button>`
  ).join('');

  wrap.querySelectorAll('.chip-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      _activeProductCategory = chip.dataset.category;
      wrap.querySelectorAll('.chip-filter').forEach(c => c.classList.toggle('active', c === chip));
      renderProductGrid();
    });
  });
}

function renderProductGrid() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const items = _activeProductCategory === 'all'
    ? _productCatalog
    : _productCatalog.filter(p => p.category === _activeProductCategory);

  if (!items.length) {
    grid.innerHTML = '<div class="catalog-empty">No products yet — add your first one above.</div>';
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="catalog-card">
      <div class="catalog-card-thumb">
        ${p.image
      ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="9" width="14" height="8" rx="1"/><path d="M15 12h4l3 3v2h-7"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>`}
      </div>
      <div class="catalog-card-category">${escapeHtml(PRODUCT_CATEGORY_LABELS[p.category] || p.category || '')}</div>
      <div class="catalog-card-name">
        ${escapeHtml(p.name)}
        ${p.badge ? `<span class="catalog-card-featured">${escapeHtml(p.badge)}</span>` : ''}
      </div>
      <div class="catalog-card-desc">${escapeHtml(p.spec || p.description || '')}</div>
      <div class="catalog-card-stock ${p.inStock === false ? 'out' : 'in'}">${p.inStock === false ? 'Out of Stock' : 'In Stock'}</div>
      <div class="catalog-card-price">${escapeHtml(p.price || '')}</div>
      <div class="catalog-card-actions">
        <button class="action-btn edit" onclick="openEditProduct(${p.id})">Edit</button>
        <button class="action-btn delete" onclick="handleDeleteProduct(${p.id})">Delete</button>
      </div>
    </div>`).join('');
}

async function handleDeleteProduct(id) {
  // 1. Check if any order contains this specific product ID
  // Your existing orders live in the global variable _allOrders
  const hasActiveOrders = _allOrders.some(order => {
    const items = order.items || [];
    return items.some(item => item.productId === id || item.id === id);
  });

  // 2. Instead of calling confirm(), pass the relation check to our new modal!
  requestDeletion('product', id, hasActiveOrders);
}

/* ── Add / Edit product modal ── */
function resetProductImageUI(imageUrl) {
  document.getElementById('product-image-url').value = imageUrl || '';
  const preview = document.getElementById('product-image-preview');
  const removeBtn = document.getElementById('product-image-remove');
  const status = document.getElementById('product-image-status');
  if (imageUrl) {
    preview.innerHTML = `<img src="${imageUrl}" alt="">`;
    removeBtn.style.display = 'block';
    status.textContent = 'Photo set';
  } else {
    preview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="9" width="14" height="8" rx="1"/><path d="M15 12h4l3 3v2h-7"/><circle cx="6" cy="19" r="1.6"/><circle cx="17.5" cy="19" r="1.6"/></svg>`;
    removeBtn.style.display = 'none';
    status.textContent = 'JPG or PNG, up to ~5MB';
  }
}

function openAddProduct() {
  setText('product-modal-eyebrow', 'Create');
  setText('product-modal-title', 'Add Product');
  document.getElementById('product-form').reset();
  document.getElementById('product-edit-id').value = '';
  document.getElementById('product-in-stock').checked = true;
  resetProductImageUI('');
  document.getElementById('product-modal').classList.add('open');
}

function openEditProduct(id) {
  const item = _productCatalog.find(p => p.id === id);
  if (!item) { alert('Could not find that product — try refreshing.'); return; }
  setText('product-modal-eyebrow', 'Edit  #' + item.id);
  setText('product-modal-title', 'Edit Product');
  document.getElementById('product-edit-id').value = item.id;
  document.getElementById('product-name').value = item.name || '';
  document.getElementById('product-brand').value = item.brand || '';
  document.getElementById('product-category').value = item.category || 'push-mower';
  document.getElementById('product-price').value = item.price || '';
  document.getElementById('product-original-price').value = item.originalPrice || '';
  document.getElementById('product-badge').value = item.badge || '';
  document.getElementById('product-spec').value = item.spec || '';
  document.getElementById('product-description').value = item.description || '';
  document.getElementById('product-in-stock').checked = item.inStock !== false;
  resetProductImageUI(item.image || '');
  document.getElementById('product-modal').classList.add('open');
}

async function handleProductImageChosen(e) {
  const file = e.target.files[0];
  if (!file) return;

  const preview = document.getElementById('product-image-preview');
  const status = document.getElementById('product-image-status');
  const saveBtn = document.getElementById('product-save-btn');

  // Show an instant local preview while the real upload happens in the background.
  const localUrl = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${localUrl}" alt="">`;
  status.textContent = 'Uploading…';
  if (saveBtn) saveBtn.disabled = true;

  try {
    const uploadedUrl = await uploadImageToCloudinary(file);
    document.getElementById('product-image-url').value = uploadedUrl;
    document.getElementById('product-image-remove').style.display = 'block';
    status.textContent = 'Photo set';
  } catch (err) {
    status.textContent = err.message || 'Upload failed — try again.';
    resetProductImageUI(document.getElementById('product-image-url').value);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function submitProductForm(e) {
  e.preventDefault();
  const editId = document.getElementById('product-edit-id').value;
  const payload = {
    name: document.getElementById('product-name').value,
    brand: document.getElementById('product-brand').value,
    category: document.getElementById('product-category').value,
    price: document.getElementById('product-price').value,
    originalPrice: document.getElementById('product-original-price').value || null,
    badge: document.getElementById('product-badge').value || null,
    spec: document.getElementById('product-spec').value,
    description: document.getElementById('product-description').value,
    image: document.getElementById('product-image-url').value || null,
    inStock: document.getElementById('product-in-stock').checked,
  };
  try {
    if (editId) await AdminApi.editProduct(editId, payload);
    else await AdminApi.addProduct(payload);
    closeModal('product-modal');
    await loadProductCatalog();
    showToast(editId ? 'Product updated.' : 'Product added.');
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
document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();

  const isLoginPage = !!document.getElementById('login-form');
  if (!isLoginPage && !getToken()) { goToLogin(); return; }

  /* Mobile sidebar */
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    /* Close sidebar when clicking outside on mobile */
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('open')
        && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  /* Dashboard page wiring */
  if (document.getElementById('panel-dashboard')) {
    document.querySelectorAll('.admin-nav a[data-panel]').forEach(a => {
      a.addEventListener('click', (e) => { e.preventDefault(); showPanel(a.dataset.panel); });
    });
    /* "View all →" link inside dashboard panel */
    document.querySelectorAll('a[data-panel]').forEach(a => {
      if (!a.closest('.admin-nav')) {
        a.addEventListener('click', (e) => { e.preventDefault(); showPanel(a.dataset.panel); });
      }
    });

    /* URL Routing Parser */
    const urlParams = new URLSearchParams(window.location.search);
    const targetPanel = urlParams.get('panel');

    if (targetPanel) {
      showPanel(targetPanel);
    } else {
      showPanel('dashboard');
    }

    loadDashboard();
  }

  const bSearch = document.getElementById('booking-search');
  if (bSearch) bSearch.addEventListener('input', () => filterBookings(bSearch.value));

  const oSearch = document.getElementById('order-search');
  if (oSearch) oSearch.addEventListener('input', () => filterOrders(oSearch.value));

  /* Services page wiring */
  if (document.getElementById('services-grid') && document.getElementById('item-form')) {
    loadServiceCatalog();
    document.getElementById('item-form').addEventListener('submit', submitItemForm);
  }

  /* Products page wiring */
  if (document.getElementById('products-grid') && document.getElementById('product-form')) {
    loadProductCatalog();
    document.getElementById('product-form').addEventListener('submit', submitProductForm);
    document.getElementById('product-image-file').addEventListener('change', handleProductImageChosen);
    document.getElementById('product-image-remove').addEventListener('click', () => {
      document.getElementById('product-image-file').value = '';
      resetProductImageUI('');
    });
  }
});
/* Logout */
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => { clearToken(); location.href = 'login.html'; });
}

/* Modal backdrop close */
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});

/* Date display */
const dateEl = document.getElementById('admin-date');
if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
/* =====================
   CHANGE PASSWORD MODAL
   ===================== */
function openChangePassword() {
  const modal = document.getElementById('change-password-modal');
  if (!modal) return;
  document.getElementById('cp-current').value = '';
  document.getElementById('cp-new').value = '';
  document.getElementById('cp-confirm').value = '';
  document.getElementById('cp-error').style.display = 'none';
  document.getElementById('cp-success').style.display = 'none';
  const btn = document.getElementById('cp-submit-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
  modal.style.display = 'flex';
}

function closeChangePassword() {
  const modal = document.getElementById('change-password-modal');
  if (modal) modal.style.display = 'none';
}

async function submitChangePassword() {
  const currentPassword = document.getElementById('cp-current').value.trim();
  const newPassword = document.getElementById('cp-new').value.trim();
  const confirmPassword = document.getElementById('cp-confirm').value.trim();
  const errorBox = document.getElementById('cp-error');
  const successBox = document.getElementById('cp-success');
  const btn = document.getElementById('cp-submit-btn');

  errorBox.style.display = 'none';
  successBox.style.display = 'none';

  if (!currentPassword) {
    errorBox.textContent = 'Please enter your current password.';
    errorBox.style.display = 'block'; return;
  }
  if (newPassword.length < 8) {
    errorBox.textContent = 'New password must be at least 8 characters.';
    errorBox.style.display = 'block'; return;
  }
  if (newPassword !== confirmPassword) {
    errorBox.textContent = 'New passwords do not match.';
    errorBox.style.display = 'block'; return;
  }
  if (currentPassword === newPassword) {
    errorBox.textContent = 'New password must be different from your current one.';
    errorBox.style.display = 'block'; return;
  }

  btn.disabled = true;
  btn.textContent = 'Updating…';

  try {
    await AdminApi.changePassword(currentPassword, newPassword);
    successBox.textContent = '✅ Password updated successfully!';
    successBox.style.display = 'block';
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    btn.textContent = 'Update Password';
    setTimeout(() => closeChangePassword(), 2000);
  } catch (err) {
    errorBox.textContent = err.message || 'Something went wrong. Please try again.';
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
}

/* Close change password modal on backdrop click */
document.addEventListener('DOMContentLoaded', () => {
  const cpModal = document.getElementById('change-password-modal');
  if (cpModal) cpModal.addEventListener('click', e => { if (e.target === cpModal) closeChangePassword(); });
});
function toggleCpField(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.querySelector('svg').innerHTML = isHidden
    ? '<path d="M3 3l18 18"/><path d="M10.6 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.15 4.15M6.5 6.6C3.6 8.4 1.5 12 1.5 12s3.5 7 10.5 7c1.6 0 3-.3 4.25-.85"/><path d="M9.5 9.9a3.2 3.2 0 0 0 4.6 4.5"/>'
    : '<path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.2"/>';
}

let currentDeleteTarget = null;

// UI SVG Icons configuration matching GreenCut aesthetics
const modalIcons = {
  warn: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  loading: `<svg class="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--forest-800)" stroke-width="2.5" style="animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke-dasharray="42 42"/></svg>`,
  success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--moss-500)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`
};

// Add standard animation styling rules for the spinner programmatically
if (!document.getElementById('gc-modal-spin-styles')) {
  const style = document.createElement('style');
  style.id = 'gc-modal-spin-styles';
  style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}

/**
 * Triggers the operational single point-of-entry delete loop
 * @param {string} type - 'product' or 'order'
 * @param {string|number} id - Target Identifier 
 * @param {boolean} [hasRelations=false] - Flag representing whether backend items point to it
 */
function requestDeletion(type, id, hasRelations = false) {
  currentDeleteTarget = { type, id, hasRelations };
  const modal = document.getElementById('gc-delete-modal');
  const iconWrap = document.getElementById('delete-modal-icon-wrap');
  const title = document.getElementById('delete-modal-title');
  const desc = document.getElementById('delete-modal-desc');
  const actionContainer = document.getElementById('delete-modal-actions');
  const closeBtn = document.getElementById('delete-modal-close');

  // Reset base UI interaction controls
  closeBtn.style.display = 'flex';
  actionContainer.style.display = 'flex';

  if (type === 'product' && hasRelations) {
    // Condition Route: Related items lock error mutation
    iconWrap.style.background = 'var(--amber-pale)';
    title.innerText = "Cannot Delete Product";
    desc.innerText = "You have an active order containing this product. Please delete the associated orders first, then try deleting this item.";

    // Morph the action controls to act simply as an acknowledge button
    actionContainer.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="closeDeleteModal()" style="border-radius: 40px; padding: 9px 32px; background: var(--sage-100)">Got it</button>`;
  } else {
    // Condition Route: Standard verification ask logic
    iconWrap.style.background = 'var(--red-pale)';
    title.innerText = type === 'product' ? "Delete Product?" : "Delete Order?";
    desc.innerText = `Are you sure you want to permanently delete this ${type}? This action will disrupt matching datasets immediately.`;

    // Render proper verification actions
    actionContainer.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="closeDeleteModal()" style="border-radius: 40px; padding: 9px 24px;">Cancel</button>
      <button class="btn btn-sm" onclick="executeBackendDeletion()" style="background: var(--red); color: #fff; border-radius: 40px; padding: 9px 24px;">Confirm Delete</button>
    `;
  }

  modal.classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('gc-delete-modal').classList.remove('open');
  currentDeleteTarget = null;
}

async function executeBackendDeletion() {
  if (!currentDeleteTarget) return;

  const iconWrap = document.getElementById('delete-modal-icon-wrap');
  const title = document.getElementById('delete-modal-title');
  const desc = document.getElementById('delete-modal-desc');
  const actionContainer = document.getElementById('delete-modal-actions');
  const closeBtn = document.getElementById('delete-modal-close');

  // Transition to Processing/Loading State
  closeBtn.style.display = 'none'; // Lock navigation exits during transition sequences
  actionContainer.style.display = 'none';
  iconWrap.style.background = 'var(--sage-100)';
  iconWrap.innerHTML = modalIcons.loading;
  title.innerText = "Deleting...";
  desc.innerText = "Communicating changes to server instances, please hold.";

  try {
    // ─── CONNECT REAL API ACTIONS HERE ───
    if (currentDeleteTarget.type === 'product') {
      await AdminApi.deleteProduct(currentDeleteTarget.id);
    } else if (currentDeleteTarget.type === 'order') {
      await AdminApi.deleteOrder(currentDeleteTarget.id);
    }
    // ─────────────────────────────────────

    // Transition to Success State
    iconWrap.style.background = 'var(--sage-100)';
    iconWrap.innerHTML = modalIcons.success;
    title.innerText = "Deleted";
    desc.innerText = "The asset registry was updated successfully.";

    // Enforce clean layout termination precisely after 0.7 seconds
    setTimeout(() => {
      closeDeleteModal();

      // Refresh matching table views securely using your file's native functions
      if (currentDeleteTarget.type === 'product') {
        loadProductCatalog();
      } else if (currentDeleteTarget.type === 'order') {
        loadOrders();
        loadDashboard(); // Updates dashboard stats too
      }
    }, 700);

  } catch (error) {
    // Emergency Error fallback pathing layout handling
    closeBtn.style.display = 'flex';
    iconWrap.style.background = 'var(--red-pale)';
    iconWrap.innerHTML = modalIcons.warn;
    title.innerText = "Deletion Failed";
    desc.innerText = error.message || "An explicit internal transport error occurred. Please verify backend state connectivity logs.";
  }
}