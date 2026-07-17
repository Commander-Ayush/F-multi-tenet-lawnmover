/* ============================
   GreenCut Storefront — main.js
   ============================
   Same visual behavior as before (mower animation, nav, toast,
   counters), PLUS the new client-side rendering layer that replaces
   what Thymeleaf used to do server-side: fetch company/services data
   on load, then fill the page in.

   Every page that needs company-dependent text just needs elements
   tagged with data-bind="<field>" — see renderCompanyInfo() below.
   No page-specific wiring required.
*/

/* =====================
   SITE CONFIG
   Flip SHOW_NAV_MOWER to false to remove the little mower that
   travels across the navbar as the page scrolls. The sticky mower
   in the corner of the page is unaffected — it's controlled by the
   #sidebar-mower element existing in the page markup, independently.
   ===================== */
const SHOW_NAV_MOWER = false;

/* =====================
   STICKY SIDEBAR + NAVBAR MOWER ANIMATION  (unchanged, purely visual)
   ===================== */
function initMower() {
  const sidebarEl = document.getElementById('sidebar-mower');
  const navMowerEl = document.getElementById('nav-mower');
  const navOverlayEl = document.getElementById('nav-cut-overlay');
  const trail = document.getElementById('mower-trail');
  const docH = () => document.documentElement.scrollHeight - window.innerHeight;

  if (!SHOW_NAV_MOWER) {
    if (navMowerEl) navMowerEl.style.display = 'none';
    if (navOverlayEl) navOverlayEl.style.display = 'none';
  }

  function update() {
    const pct = docH() > 0 ? window.scrollY / docH() : 0;
    if (sidebarEl) {
      const minTop = 90;
      const maxTop = window.innerHeight - 140;
      sidebarEl.style.top = (minTop + pct * (maxTop - minTop)) + 'px';
      if (trail) trail.style.height = (pct * 60) + 'px';
    }
    if (navMowerEl && SHOW_NAV_MOWER) {
      document.documentElement.style.setProperty('--nav-mower-pct', `${(pct * 100).toFixed(2)}%`);
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* =====================
   NAVBAR (mobile hamburger) — active link is set server-... no wait,
   there's no server now. Set it from the current page's filename.
   ===================== */
function initNav() {
  const ham = document.querySelector('.hamburger');
  const links = document.querySelector('.nav-links');
  if (ham && links) ham.addEventListener('click', () => links.classList.toggle('open'));

  const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path || (path === '' && href === 'index.html')) a.classList.add('active');
  });
}

/* =====================
   TOAST  (unchanged)
   ===================== */
function showToast(msg, duration = 3500) {
  let t = document.getElementById('gc-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'gc-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* =====================
   STAT COUNTERS — now takes the target numbers as an argument,
   since they come from the API instead of being baked into the HTML.
   ===================== */
function initCounters() {
  const els = document.querySelectorAll('.count-up');
  if (!els.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = parseInt(el.dataset.target, 10) || 0;
      let cur = 0;
      const step = Math.ceil(end / 60) || 1;
      const t = setInterval(() => {
        cur = Math.min(cur + step, end);
        el.textContent = cur.toLocaleString() + (el.dataset.suffix || '');
        if (cur >= end) clearInterval(t);
      }, 28);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  els.forEach(el => observer.observe(el));
}

/* =====================
   GENERIC COMPANY DATA-BINDER
   Any element with data-bind="fieldName" gets its text replaced with
   company[fieldName]. Any element with data-bind-attr="attr:fieldName"
   gets that attribute set instead (for href="tel:..." etc).
   One function, works on every page, zero per-page wiring.
   ===================== */
function renderCompanyInfo(company) {
  document.querySelectorAll('[data-bind]').forEach(el => {
    const field = el.dataset.bind;
    if (company[field] !== undefined && company[field] !== null) {
      const prefix = el.dataset.bindPrefix || '';
      el.textContent = prefix + company[field];
    }
  });

  document.querySelectorAll('[data-bind-attr]').forEach(el => {
    const [attr, field] = el.dataset.bindAttr.split(':');
    if (company[field] !== undefined && company[field] !== null) {
      if (attr === 'href-tel') el.setAttribute('href', 'tel:' + company[field]);
      else if (attr === 'href-mailto') el.setAttribute('href', 'mailto:' + company[field]);
      else el.setAttribute(attr, company[field]);
    }
  });

  // Stat counters that depend on company numbers specifically
  const yardsEl = document.querySelector('.count-up[data-bind-target="yardsServed"]');
  if (yardsEl) yardsEl.dataset.target = company.yardsServed;
  const yearsEl = document.querySelector('.count-up[data-bind-target="yearsExperience"]');
  if (yearsEl) yearsEl.dataset.target = company.yearsExperience;

  document.title = document.title.replace('{companyName}', company.name);
}

/* =====================
   SKELETON LOADING WIDGETS
   Rendered immediately (before the fetch resolves) so the page never
   shows a blank gap or a plain "Loading…" line. Swapped out for the
   real cards the moment the data arrives.
   ===================== */
const DEFAULT_SERVICE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c3-6 5-9 8-9s5 3 8 9"/><circle cx="12" cy="7" r="3.2"/></svg>';

function renderCardSkeletons(containerId, count = 4) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skel-card">
      <div class="skel-block skel-icon"></div>
      <div class="skel-block skel-line w-60"></div>
      <div class="skel-block skel-line w-90"></div>
      <div class="skel-block skel-line w-40"></div>
    </div>`).join('');
}

function renderPricingSkeletons(containerId, count = 3) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skel-pricing">
      <div class="skel-block skel-line title"></div>
      <div class="skel-block skel-line price"></div>
      <div class="skel-block skel-line feature"></div>
      <div class="skel-block skel-line feature"></div>
      <div class="skel-block skel-line feature"></div>
    </div>`).join('');
}

function renderReviewSkeletons(containerId, count = 3) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skel-review">
      <div class="skel-block skel-line stars"></div>
      <div class="skel-block skel-line text"></div>
      <div class="skel-block skel-line text"></div>
      <div class="skel-block skel-line text"></div>
      <div class="skel-review-footer">
        <div class="skel-block skel-avatar"></div>
        <div class="skel-lines">
          <div class="skel-block skel-line name"></div>
          <div class="skel-block skel-line loc"></div>
        </div>
      </div>
    </div>`).join('');
}

/* =====================
   SERVICES / PLANS / ADD-ONS — build the cards client-side
   ===================== */
function renderServiceCards(containerId, services) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!services.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">Nothing here yet.</div>';
    return;
  }
  grid.innerHTML = services.map(s => `
    <div class="card">
      <div class="card-icon">${s.icon || DEFAULT_SERVICE_ICON}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.description || '')}</p>
      <div style="margin-top:14px;font-family:'Fraunces',serif;font-size:1.2rem;color:var(--green-dark);font-weight:600;">
        ${escapeHtml(s.price || '')}
      </div>
    </div>`).join('');
}

function renderPlanCards(containerId, plans) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!plans.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">No plans listed yet.</div>';
    return;
  }
  grid.innerHTML = plans.map(p => `
    <div class="pricing-card ${p.featured ? 'featured' : ''}">
      ${p.featured ? '<span class="badge-popular">Most Popular</span>' : ''}
      <h3>${escapeHtml(p.name)}</h3>
      <div class="price">${escapeHtml(p.price || '')}</div>
      <div class="freq">${escapeHtml(p.description || 'Billed monthly · Cancel anytime')}</div>
      <ul>${(p.features || []).map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
      <a href="booking.html" class="btn btn-green" style="display:block;text-align:center;">Book This Plan</a>
    </div>`).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* =====================
   BOOKING FORM — dropdown populated from real services/plans/addons,
   submit goes through Api.submitBooking() instead of a page POST.
   ===================== */
async function initBookingForm() {
  const form = document.getElementById('booking-form');
  if (!form) return;

  const sel = form.querySelector('#svc-select');
  if (sel) {
    try {
      const [services, plans, addons] = await Promise.all([
        Api.getServices(), Api.getPlans(), Api.getAddons()
      ]);
      sel.innerHTML = '<option value="" disabled selected>— Choose a service —</option>' +
        buildOptGroup('Services', services) +
        buildOptGroup('Monthly Plans', plans) +
        buildOptGroup('Add-Ons', addons);
    } catch (err) {
      console.error('Could not load services for booking form', err);
      sel.innerHTML = '<option value="" disabled selected>Could not load services — call us instead</option>';
    }
  }

  // Set min date to today
  const dateInput = document.getElementById('pref_date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    const fd = new FormData(form);
    const payload = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      address: fd.get('address'),
      serviceOfferingId: fd.get('service') ? Number(fd.get('service')) : null,
      preferredDate: fd.get('pref_date') || null,
      notes: fd.get('notes'),
    };

    try {
      await Api.submitBooking(payload);
      document.getElementById('form-wrap').style.display = 'none';
      const sm = document.getElementById('success-msg');
      if (sm) sm.classList.add('show');
      showToast("Booking submitted — we'll confirm within 24 hours.");
    } catch (err) {
      console.error(err);
      showToast("Something went wrong submitting your booking — please call us instead.", 5000);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}

function buildOptGroup(label, items) {
  if (!items || !items.length) return '';
  const options = items.map(i =>
    `<option value="${i.id}">${escapeHtml(i.name)} — ${escapeHtml(i.price || '')}</option>`
  ).join('');
  return `<optgroup label="${label}">${options}</optgroup>`;
}

/* =====================
   REVIEWS PAGE — live cards from the backend + submission form
   ===================== */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.length > 1
    ? parts[0][0] + parts[parts.length - 1][0]
    : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

function renderReviews(reviews) {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  if (!reviews.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">No reviews yet — be the first!</div>';
    return;
  }

  const avgStars = reviews.reduce((s, r) => s + r.stars, 0) / reviews.length;
  const avgEl = document.getElementById('avg-rating');
  const countEl = document.getElementById('review-count');
  if (avgEl) avgEl.textContent = avgStars.toFixed(1);
  if (countEl) countEl.textContent = `Based on ${reviews.length} review${reviews.length === 1 ? '' : 's'}`;

  for (let star = 1; star <= 5; star++) {
    const cnt = reviews.filter(r => r.stars === star).length;
    const pct = reviews.length > 0 ? (cnt / reviews.length * 100).toFixed(0) : 0;
    const bar = document.getElementById(`bar-${star}`);
    const label = document.getElementById(`pct-${star}`);
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
  }

  grid.innerHTML = reviews.map((r) => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const city = r.reviewerCity ? escapeHtml(r.reviewerCity) : '';
    return `
      <div class="review-card">
        <div class="stars">${stars}</div>
        <p class="review-text">${escapeHtml(r.text)}</p>
        <div class="reviewer">
          <div class="reviewer-avatar">${getInitials(r.reviewerName)}</div>
          <div class="reviewer-info">
            <div class="name">${escapeHtml(r.reviewerName)}</div>
            ${city ? `<div class="location">${city}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function initReviewForm() {
  const form = document.getElementById('review-form');
  if (!form) return;

  const starBtns = form.querySelectorAll('.star-btn');
  const starInput = document.getElementById('star-input');
  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.star);
      if (starInput) starInput.value = val;
      starBtns.forEach(b => {
        b.textContent = Number(b.dataset.star) <= val ? '★' : '☆';
        b.classList.toggle('selected', Number(b.dataset.star) <= val);
      });
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalLabel = btn ? btn.textContent : null;
    const stars = Number(document.getElementById('star-input').value);
    if (!stars) { showToast('Please select a star rating first.', 3000); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    const payload = {
      reviewerName: form.querySelector('[name="reviewerName"]').value.trim(),
      reviewerCity: form.querySelector('[name="reviewerCity"]').value.trim(),
      stars,
      text: form.querySelector('[name="text"]').value.trim(),
    };

    try {
      await Api.submitReview(payload);
      document.getElementById('review-form-wrap').style.display = 'none';
      const sm = document.getElementById('review-success');
      if (sm) sm.style.display = 'block';
      showToast('Review submitted — it will appear after approval.');
    } catch (err) {
      console.error(err);
      showToast('Something went wrong — please try again.', 5000);
      if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
    }
  });
}

/* =====================
   PAGE-LEVEL BOOTSTRAP
   Each page just needs to list which of these it actually has;
   everything no-ops cleanly if its container isn't on the page.
   ===================== */
async function loadCompanyAndRender() {
  try {
    const company = await Api.getCompany();
    renderCompanyInfo(company);
    return company;
  } catch (err) {
    console.error('Could not load company info', err);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initMower();

  await loadCompanyAndRender();
  initCounters();

  if (document.getElementById('home-reviews-grid')) {
    renderReviewSkeletons('home-reviews-grid', 3);
    Api.getReviews()
      .then(r => renderHomeReviews(r))
      .catch(err => console.error('home reviews load failed', err));
  }

  if (document.getElementById('services-grid')) {
    renderCardSkeletons('services-grid', 6);
    Api.getServices().then(s => renderServiceCards('services-grid', s))
      .catch(err => console.error('services load failed', err));
  }
  if (document.getElementById('pricing-grid')) {
    renderPricingSkeletons('pricing-grid', 3);
    Api.getPlans().then(p => renderPlanCards('pricing-grid', p))
      .catch(err => console.error('plans load failed', err));
  }
  if (document.getElementById('addons-grid')) {
    renderCardSkeletons('addons-grid', 3);
    Api.getAddons().then(a => {
      const section = document.getElementById('addons-section');
      if (!a.length && section) { section.style.display = 'none'; return; }
      renderServiceCards('addons-grid', a);
    }).catch(err => console.error('addons load failed', err));
  }

  if (document.getElementById('reviews-grid')) {
    renderReviewSkeletons('reviews-grid', 3);
    Api.getReviews().then(r => renderReviews(r))
      .catch(err => console.error('reviews load failed', err));
  }

  if (document.getElementById('products-grid')) {
    renderProductSkeletons('products-grid', 6);
    Api.getProducts().then(products => {
      STORE.products = products;
      renderProductCards(products);
      initCategoryTabs();
    }).catch(err => {
      console.error('products load failed', err);
      const grid = document.getElementById('products-grid');
      if (grid) grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">Could not load products right now — please call us or check back shortly.</div>';
    });
    initCart();
    initCheckoutForm();
  }

  initBookingForm();
  initReviewForm();
});

/* =====================
   HOME PAGE REVIEW SNIPPET
   Filters 4★ and 5★ only, max 4 cards.
   Uses id="home-reviews-grid" so it doesn't clash with
   the full reviews page grid (id="reviews-grid").
   ===================== */
function renderHomeReviews(reviews) {
  const grid = document.getElementById('home-reviews-grid');
  if (!grid) return;

  const filtered = reviews
    .filter(r => r.stars >= 4)
    .slice(0, 4);

  if (!filtered.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">No reviews yet — be the first!</div>';
    return;
  }

  grid.innerHTML = filtered.map(r => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const city = r.reviewerCity ? escapeHtml(r.reviewerCity) : '';
    return `
      <div class="review-card">
        <div class="stars">${stars}</div>
        <p class="review-text">"${escapeHtml(r.text)}"</p>
        <div class="reviewer">
          <div class="reviewer-avatar">${getInitials(r.reviewerName)}</div>
          <div class="reviewer-info">
            <div class="name">${escapeHtml(r.reviewerName)}</div>
            ${city ? `<div class="location">${city}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}
/* =====================================================
   SHOP / STORE PAGE
   Category filtering, an in-memory + localStorage cart,
   and an order checkout form — same "one function per
   concern, no-ops if the container isn't on the page"
   pattern as the rest of this file.
   ===================================================== */

const CART_STORAGE_KEY = 'gc_cart';

const STORE = {
  products: [],       // full product list from the API
  activeCategory: 'all',
};

const CATEGORY_LABELS = {
  'push-mower': 'Push Mowers',
  'riding-mower': 'Riding Mowers',
  'robotic-mower': 'Robotic Mowers',
  'trimmer': 'Trimmers & Edgers',
  'blower': 'Blowers & Vacuums',
  'accessory': 'Parts & Accessories',
};

const DEFAULT_PRODUCT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="14" height="9" rx="1"/><path d="M17 12h3l2 2.5V18h-5"/><circle cx="7.5" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/></svg>';

/* ---- price helpers ---- */
function parsePrice(priceStr) {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const n = parseFloat(String(priceStr).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function formatMoney(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---- cart persistence ---- */
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveCart(cart) {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (_) { /* storage unavailable — cart just won't persist */ }
}

function getCart() { return loadCart(); }

function findProduct(id) {
  return STORE.products.find(p => String(p.id) === String(id));
}

function addToCart(productId, qty) {
  const cart = loadCart();
  const existing = cart.find(i => String(i.productId) === String(productId));
  if (existing) existing.qty += qty;
  else cart.push({ productId, qty });
  saveCart(cart);
  renderCartUI();
  const product = findProduct(productId);
  showToast(`${product ? product.name : 'Item'} added to cart`);
}

function updateCartQty(productId, qty) {
  let cart = loadCart();
  if (qty <= 0) {
    cart = cart.filter(i => String(i.productId) !== String(productId));
  } else {
    const item = cart.find(i => String(i.productId) === String(productId));
    if (item) item.qty = qty;
  }
  saveCart(cart);
  renderCartUI();
}

function cartSubtotal(cart) {
  return cart.reduce((sum, item) => {
    const p = findProduct(item.productId);
    return sum + (p ? parsePrice(p.price) * item.qty : 0);
  }, 0);
}

/* ---- product rendering ---- */
function renderProductSkeletons(containerId, count = 6) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skel-product">
      <div class="skel-img"></div>
      <div class="skel-body">
        <div class="skel-block skel-line w-40" style="margin-bottom:12px"></div>
        <div class="skel-block skel-line w-90" style="margin-bottom:10px"></div>
        <div class="skel-block skel-line w-60"></div>
      </div>
    </div>`).join('');
}

function stockLabel(stock) {
  if (stock === 'low-stock') return 'Low Stock';
  if (stock === 'out-of-stock') return 'Out of Stock';
  return 'In Stock';
}

function renderProductCards(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const filtered = STORE.activeCategory === 'all'
    ? products
    : products.filter(p => p.category === STORE.activeCategory);

  if (!filtered.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">Nothing in this category yet — check back soon or call us for availability.</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const outOfStock = p.stock === 'out-of-stock';
    const badge = p.badge ? `<span class="product-badge ${p.badge.toLowerCase() === 'sale' ? 'sale' : (p.badge.toLowerCase() === 'new' ? 'new' : '')}">${escapeHtml(p.badge)}</span>` : '';
    const image = p.image
      ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">`
      : DEFAULT_PRODUCT_ICON;
    const original = p.originalPrice ? `<span class="product-price-original">${escapeHtml(p.originalPrice)}</span>` : '';

    return `
    <div class="product-card" data-category="${escapeHtml(p.category || '')}" data-id="${escapeHtml(String(p.id))}">
      <div class="product-image-wrap">
        ${badge}
        ${image}
      </div>
      <div class="product-body">
        ${p.brand ? `<div class="product-brand">${escapeHtml(p.brand)}</div>` : ''}
        <h3>${escapeHtml(p.name)}</h3>
        <div class="product-spec">${escapeHtml(p.spec || '')}</div>
        <div class="stock-pill ${escapeHtml(p.stock || 'in-stock')}">${stockLabel(p.stock)}</div>
        <div class="product-price-row">
          <span class="product-price">${escapeHtml(p.price || '')}</span>
          ${original}
        </div>
        <div class="product-actions">
          <div class="qty-stepper" data-qty="1">
            <button type="button" class="qty-minus" aria-label="Decrease quantity">−</button>
            <span>1</span>
            <button type="button" class="qty-plus" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn-add-cart" ${outOfStock ? 'disabled' : ''}>
            ${outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.product-card').forEach(card => {
    const stepper = card.querySelector('.qty-stepper');
    const qtyLabel = stepper.querySelector('span');
    stepper.querySelector('.qty-minus').addEventListener('click', () => {
      const next = Math.max(1, Number(stepper.dataset.qty) - 1);
      stepper.dataset.qty = next;
      qtyLabel.textContent = next;
    });
    stepper.querySelector('.qty-plus').addEventListener('click', () => {
      const next = Number(stepper.dataset.qty) + 1;
      stepper.dataset.qty = next;
      qtyLabel.textContent = next;
    });
    const addBtn = card.querySelector('.btn-add-cart');
    if (addBtn && !addBtn.disabled) {
      addBtn.addEventListener('click', () => {
        addToCart(card.dataset.id, Number(stepper.dataset.qty));
        stepper.dataset.qty = 1;
        qtyLabel.textContent = 1;
      });
    }
  });
}

/* ---- category tabs ---- */
function initCategoryTabs() {
  const tabsWrap = document.getElementById('category-tabs');
  if (!tabsWrap) return;

  const present = new Set(STORE.products.map(p => p.category));
  const tabs = [{ key: 'all', label: 'All Equipment' }]
    .concat(Object.keys(CATEGORY_LABELS).filter(k => present.has(k)).map(k => ({ key: k, label: CATEGORY_LABELS[k] })));

  tabsWrap.innerHTML = tabs.map(t =>
    `<button type="button" class="tab-btn ${t.key === STORE.activeCategory ? 'active' : ''}" data-category="${t.key}">${t.label}</button>`
  ).join('');

  tabsWrap.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STORE.activeCategory = btn.dataset.category;
      tabsWrap.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderProductCards(STORE.products);
    });
  });
}

/* ---- cart drawer UI ---- */
function renderCartUI() {
  const cart = getCart();
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  if (countEl) {
    countEl.textContent = totalQty;
    countEl.style.display = totalQty > 0 ? 'flex' : 'none';
  }

  if (!itemsEl) return;

  if (!cart.length) {
    itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Browse equipment and add something to get started.</div>';
    if (subtotalEl) subtotalEl.textContent = formatMoney(0);
    if (checkoutBtn) checkoutBtn.disabled = true;
    renderOrderSummary();
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  itemsEl.innerHTML = cart.map(item => {
    const p = findProduct(item.productId);
    if (!p) return '';
    const image = p.image ? `<img src="${p.image}" alt="${escapeHtml(p.name)}">` : DEFAULT_PRODUCT_ICON;
    return `
      <div class="cart-item" data-id="${escapeHtml(String(item.productId))}">
        <div class="cart-item-img">${image}</div>
        <div class="cart-item-info">
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="unit-price">${escapeHtml(p.price)} × ${item.qty}</div>
          <button type="button" class="cart-item-remove">Remove</button>
        </div>
        <div class="qty-stepper" data-qty="${item.qty}">
          <button type="button" class="qty-minus" aria-label="Decrease quantity">−</button>
          <span>${item.qty}</span>
          <button type="button" class="qty-plus" aria-label="Increase quantity">+</button>
        </div>
      </div>`;
  }).join('');

  itemsEl.querySelectorAll('.cart-item').forEach(row => {
    const id = row.dataset.id;
    const stepper = row.querySelector('.qty-stepper');
    stepper.querySelector('.qty-minus').addEventListener('click', () => {
      const next = Number(stepper.dataset.qty) - 1;
      updateCartQty(id, next);
    });
    stepper.querySelector('.qty-plus').addEventListener('click', () => {
      const next = Number(stepper.dataset.qty) + 1;
      updateCartQty(id, next);
    });
    row.querySelector('.cart-item-remove').addEventListener('click', () => updateCartQty(id, 0));
  });

  if (subtotalEl) subtotalEl.textContent = formatMoney(cartSubtotal(cart));
  renderOrderSummary();
}

function initCart() {
  const fab = document.getElementById('cart-fab');
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const closeBtn = document.getElementById('cart-close-btn');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  function openDrawer() {
    if (drawer) drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
  }
  function closeDrawer() {
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  if (fab) fab.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      closeDrawer();
      const checkoutSection = document.getElementById('checkout-section');
      if (checkoutSection) checkoutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  renderCartUI();
}

/* ---- order summary + checkout form ---- */
function renderOrderSummary() {
  const el = document.getElementById('order-summary-body');
  if (!el) return;
  const cart = getCart();

  if (!cart.length) {
    el.innerHTML = '<p style="color:var(--text-light);font-size:.9rem">Your cart is empty — add equipment above before checking out.</p>';
    return;
  }

  const rows = cart.map(item => {
    const p = findProduct(item.productId);
    if (!p) return '';
    return `<div class="order-summary-row"><span>${escapeHtml(p.name)} × ${item.qty}</span><span>${formatMoney(parsePrice(p.price) * item.qty)}</span></div>`;
  }).join('');

  const subtotal = cartSubtotal(cart);
  el.innerHTML = rows + `<div class="order-summary-row total"><span>Estimated Total</span><span>${formatMoney(subtotal)}</span></div>`;
}

function initCheckoutForm() {
  const form = document.getElementById('checkout-form');
  if (!form) return;

  const options = form.querySelectorAll('.fulfillment-option');
  const addressGroup = document.getElementById('delivery-address-group');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const radio = opt.querySelector('input[type="radio"]');
      radio.checked = true;
      const isDelivery = radio.value === 'delivery';
      if (addressGroup) addressGroup.style.display = isDelivery ? 'flex' : 'none';
      const addressInput = document.getElementById('order-address');
      if (addressInput) addressInput.required = isDelivery;
    });
  });

  const dateInput = document.getElementById('order-pref-date');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cart = getCart();
    if (!cart.length) {
      showToast('Your cart is empty — add something to your order first.', 3500);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : null;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    const fd = new FormData(form);
    const payload = {
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      fulfillment: fd.get('fulfillment') || 'pickup',
      address: fd.get('address') || null,
      preferredDate: fd.get('pref_date') || null,
      notes: fd.get('notes'),
      items: cart.map(i => ({ productId: i.productId, quantity: i.qty })),
    };

    try {
      await Api.submitOrder(payload);
      saveCart([]);
      renderCartUI();
      document.getElementById('checkout-form-wrap').style.display = 'none';
      const sm = document.getElementById('order-success-msg');
      if (sm) sm.classList.add('show');
      showToast("Order request submitted — we'll confirm within 24 hours.");
    } catch (err) {
      console.error(err);
      showToast('Something went wrong submitting your order — please call us instead.', 5000);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
    }
  });
}
