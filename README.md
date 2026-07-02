# GreenCut — fetch-based frontend (no Thymeleaf)

Two separate apps, deployed to two different places:

```
storefront/      → deploy THIS, unchanged, to every client's Hostinger account
admin-panel/      → deploy THIS once, centrally (e.g. on the VPS itself)
CONTRACT.md       → the exact API the backend needs to implement next
```

## Why two apps

- **`storefront/`** is the public-facing site (home/services/booking/reviews).
  It identifies which business it's for via the browser's `Origin` header —
  nothing in these files is business-specific. That means **the exact same
  files get uploaded to every client's Hostinger hosting**, unmodified. No
  per-client build step, no templating, no editing.

- **`admin-panel/`** is the business owner's login + dashboard. It doesn't
  need to live on each client's domain at all — a JWT obtained at login
  already carries which business an admin belongs to, so **one deployment
  of this app, on one URL, serves every client**. Simplest place for it is
  right on your VPS (e.g. `admin.yourdomain.com`), but it could just as
  easily be a 51st Hostinger site if that's more convenient.

## Before deploying

Both apps have exactly one line to change, at the top of their `js/*-api.js`:

```js
const API_BASE = "http://localhost:8080"; // ← change to your VPS's real address
```

`storefront/js/api.js` and `admin-panel/js/admin-api.js` — that's the entire
configuration surface. Everything else figures itself out at runtime from
what the backend returns.

## What's already wired up

- **Storefront**: company info, services/plans/addons cards, and the booking
  form's service dropdown are all populated live via `fetch()` — see
  `storefront/js/main.js`. The booking form posts a real `serviceOfferingId`
  (not a free-text code), so the backend can compute real revenue from the
  actual `ServiceOffering` price instead of guessing.
- **Admin panel**: login → JWT → localStorage → every subsequent request
  carries `Authorization: Bearer <token>`. A `401` from any admin endpoint
  auto-clears the token and bounces back to `login.html` — so token
  expiry just becomes "please log in again," no extra backend signaling
  needed beyond the status code.
- **CORS**: the backend will need to allow the storefront's domains as
  origins (and the admin panel's, separately) — see `CONTRACT.md`.

## What I verified before handing this over

I ran both apps end-to-end in a headless browser (jsdom) against a mocked
backend matching `CONTRACT.md` exactly — company/services/plans/addons
rendering, the full booking submission flow, admin login, dashboard stats,
the bookings search filter, sales charts, and the services add/edit/delete
flow. All passed. The only things I couldn't test here are things that need
a *real* backend and browser: actual CORS behavior, real JWT expiry, and the
real visual look (no real GPU/screenshot in this environment) — worth a
quick manual click-through once the backend's up, but the logic itself is
solid.

## Next step

Build the backend to satisfy `CONTRACT.md` exactly, and neither app needs
to change at all.
"# F-multi-tenet-lawnmover" 
