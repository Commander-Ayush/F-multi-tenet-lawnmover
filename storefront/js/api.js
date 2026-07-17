const API_BASE = "https://growthmultiplier.online";

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

  // GET /products  -> [ { id, sku, name, brand, category, image, price,
  //                        originalPrice, badge, stock, spec, description } ]
  // category is one of: "push-mower" | "riding-mower" | "robotic-mower" |
  //                      "trimmer" | "blower" | "accessory"
  // stock is one of: "in-stock" | "low-stock" | "out-of-stock"
  getProducts: () => apiGet("/products"),

  // POST /orders  body: { firstName, lastName, email, phone, fulfillment,
  //                         address, preferredDate, notes,
  //                         items: [ { productId, quantity } ] }
  // fulfillment is "pickup" or "delivery" — address only required for delivery.
  submitOrder: (payload) => apiPost("/orders", payload),
};