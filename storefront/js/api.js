/* ============================
   GreenCut Storefront — API layer
   ============================
   Every public page talks to the backend through THIS file only.
   One constant to change when you go live — nothing else in the
   frontend needs to know or care where the backend lives.

   Tenant resolution: the backend identifies which business this is
   purely from the browser's automatic `Origin` header — we never
   send a company id from here. See CONTRACT.md for the full spec.
*/

const API_BASE = "http://localhost:8080"; // ← change this once, to your VPS's address, when going live

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // try to surface a server-sent error message if there is one
    let message = `POST ${path} failed: ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody && errBody.message) message = errBody.message;
    } catch (_) { /* response wasn't JSON — keep the generic message */ }
    throw new Error(message);
  }
  // Some endpoints (like booking submission) may return 200 with no body
  return res.status === 204 ? null : res.json().catch(() => null);
}

const Api = {
  // GET /company            -> { name, city, foundedYear, yardsServed, yearsExperience, phone, email }
  getCompany: () => apiGet("/company"),

  // GET /services            -> [ { id, icon, name, description, price, featured } , ... ]
  getServices: () => apiGet("/services"),

  // GET /services/plans      -> same shape as above, type = "plan"
  getPlans: () => apiGet("/services/plans"),

  // GET /services/addons     -> same shape as above, type = "addon"
  getAddons: () => apiGet("/services/addons"),

  // POST /booking  body: { firstName, lastName, phone, email, address,
  //                         serviceOfferingId, preferredDate, notes }
  submitBooking: (payload) => apiPost("/booking", payload),

  // GET /reviews  -> [ { id, reviewerName, reviewerCity, stars, text, submittedAt } ]
  // Only returns approved reviews — backend filters before sending.
  getReviews: () => apiGet("/reviews"),

  // POST /reviews  body: { reviewerName, reviewerCity, stars, text }
  submitReview: (payload) => apiPost("/reviews", payload),
};