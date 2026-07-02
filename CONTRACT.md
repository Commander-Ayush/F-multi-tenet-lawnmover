# API Contract — Frontend ↔ Backend

This is exactly what `storefront/js/api.js` and `admin-panel/js/admin-api.js`
call. Build the backend to match this and the frontend needs zero changes.

Base URL: one constant (`API_BASE`) at the top of each `*-api.js` file —
currently `http://localhost:8080` for local dev.

---

## Public routes (storefront) — tenant resolved via `Origin` header, no auth

### `GET /company`
→ `200 OK`
```json
{ "name": "GreenCut", "city": "Austin", "foundedYear": 2015,
  "yardsServed": 4800, "yearsExperience": 11,
  "phone": 8004736288, "email": "hello@greencut.com" }
```

### `GET /services`
Same shape repeated for `/services/plans` and `/services/addons` (type filtered server-side).
→ `200 OK`
```json
[ { "id": 1, "icon": "🌿", "name": "Mow & Edge", "description": "...",
    "price": "$45 / visit", "featured": false, "features": [] } ]
```
`features` is only meaningfully used for plans (rendered as the bullet list);
harmless if empty/absent for services and addons.

### `POST /booking`
Body:
```json
{ "firstName": "Jane", "lastName": "Doe", "email": "jane@x.com",
  "phone": "555-1111", "address": "123 Main St",
  "serviceOfferingId": 1, "preferredDate": "2026-07-01", "notes": "" }
```
→ any `2xx` is treated as success. `serviceOfferingId` is the real `id` from
`/services`, `/services/plans`, or `/services/addons` — **not** a free-text
code. (This is the fix for the old revenue-estimation hack — once bookings
reference a real `ServiceOffering`, revenue can be computed from its actual
price instead of a guessed lookup table.)

On failure, respond with a JSON body `{ "message": "..." }` if you want that
message surfaced to the visitor — the frontend reads it.

---

## Admin routes — JWT only, `Authorization: Bearer <token>`. No domain/Origin involved.

### `POST /auth/login` (not authed — this is how a token is obtained)
Body: `{ "email": "...", "password": "..." }`
→ `200 OK`: `{ "token": "<jwt>" }`
→ `401`: incorrect credentials

### `GET /admin/dashboard/summary`
→ `200 OK`
```json
{
  "totalRequests": 12, "monthBookings": 3, "pending": 4, "completed": 8,
  "totalRevenue": 1850, "monthRevenue": 220,
  "activeServiceCount": 6, "completionRate": 66.6, "avgJobValue": 231.25,
  "yearRevenue": 1850, "yearBookings": 12, "currentYearLabel": "2026",
  "monthlyChart": [ { "label": "Jan", "revenue": 100, "count": 2 } ],
  "serviceBreakdown": { "Lawn Mowing": 5, "Trimming": 3 },
  "recentRequests": [ { "id": 1, "firstName": "Jane", "lastName": "Doe",
                         "service": "Lawn Mowing", "preferredDate": "2026-07-01",
                         "completed": false } ]
}
```
This is the same analytics shape from the earlier Thymeleaf `AdminController.dashboard()`
work — just returned as JSON instead of injected into a template.

### `GET /admin/bookings`
→ `200 OK`
```json
[ { "id": 1, "firstName": "Jane", "lastName": "Doe", "email": "jane@x.com",
    "phone": "555-1111", "service": "Lawn Mowing", "preferredDate": "2026-07-01",
    "submittedAt": "2026-06-20T10:00:00", "completed": false } ]
```
`service` should be a **human-readable label** (resolve it from the linked
`ServiceOffering`, not a raw code) — the admin table displays it as-is.

### `POST /admin/bookings/{id}/complete`, `POST /admin/bookings/{id}/reopen`, `DELETE /admin/bookings/{id}`
→ any `2xx`. Body not required.

### `GET /admin/services`
→ `200 OK`
```json
{ "services": [ {...} ], "plans": [ {...} ], "addons": [ {...} ] }
```
Each item: `{ "id", "icon", "name", "description", "price", "featured", "type" }`

### `POST /admin/services` (add), `PUT /admin/services/{id}` (edit)
Body: `{ "icon", "name", "description", "price", "featured", "type" }`
→ any `2xx`

### `DELETE /admin/services/{id}`
→ any `2xx`

### `POST /admin/account/password`
Body: `{ "currentPassword", "newPassword" }`
→ `200 OK` on success, `401` if `currentPassword` is wrong

---

## Error format (optional but recommended)
Any non-2xx response can optionally include:
```json
{ "message": "Human-readable reason" }
```
Both `api.js` and `admin-api.js` will surface this message if present, otherwise fall back to a generic "Request failed: &lt;status&gt;".

## On 401 specifically (admin routes)
Every admin request that gets a `401` automatically clears the stored token
and redirects to `login.html` — so an expired/invalid JWT self-heals into a
re-login prompt with no extra backend work needed beyond returning 401.
