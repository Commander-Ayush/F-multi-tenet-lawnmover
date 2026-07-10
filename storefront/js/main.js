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
const SHOW_NAV_MOWER = true;

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

function renderReviews(reviews, allReviews = null) {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  if (!reviews.length) {
    grid.innerHTML = '<div style="color:var(--text-light);text-align:center;padding:40px;grid-column:1/-1">No reviews yet — be the first!</div>';
    return;
  }

  const avgStars = (allReviews || reviews).reduce((s, r) => s + r.stars, 0) / (allReviews || reviews).length;
  const total = (allReviews || reviews).length;
  const avgEl = document.getElementById('avg-rating');
  const countEl = document.getElementById('review-count');
  if (avgEl) avgEl.textContent = avgStars.toFixed(1);
  if (countEl) countEl.textContent = `Based on ${total} review${total === 1 ? '' : 's'}`;

  for (let star = 1; star <= 5; star++) {
    const cnt = (allReviews || reviews).filter(r => r.stars === star).length;
    const pct = total > 0 ? (cnt / total * 100).toFixed(0) : 0;
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

  // Show "See all reviews" button if there are more than 3
  const existing = document.getElementById('show-all-reviews-btn');
  if (existing) existing.remove();

  if (allReviews && allReviews.length > 3) {
    const btn = document.createElement('div');
    btn.id = 'show-all-reviews-btn';
    btn.style.cssText = 'grid-column:1/-1;text-align:center;margin-top:8px';
    btn.innerHTML = `<button class="btn btn-green" onclick="showAllReviews()">See all reviews →</button>`;
    grid.appendChild(btn);

    window._allReviewsCache = allReviews;
  }
}

function showAllReviews() {
  const all = window._allReviewsCache || [];
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;

  // Re-render without slicing, remove button
  const btn = document.getElementById('show-all-reviews-btn');
  if (btn) btn.remove();

  // append remaining cards
  const remaining = all.slice(3);
  remaining.forEach(r => {
    const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
    const city = r.reviewerCity ? escapeHtml(r.reviewerCity) : '';
    const card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML = `
      <div class="stars">${stars}</div>
      <p class="review-text">${escapeHtml(r.text)}</p>
      <div class="reviewer">
        <div class="reviewer-avatar">${getInitials(r.reviewerName)}</div>
        <div class="reviewer-info">
          <div class="name">${escapeHtml(r.reviewerName)}</div>
          ${city ? `<div class="location">${city}</div>` : ''}
        </div>
      </div>`;
    grid.appendChild(card);
  });
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
    Api.getReviews().then(r => {
      renderReviews(r.slice(0, 3), r);
    }).catch(err => console.error('reviews load failed', err));
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
    .slice(0, 3);

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