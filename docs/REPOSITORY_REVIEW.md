# ReliefOps repository review

Reviewed on 23 November 2026, before the dashboard and donation implementation.
This historical snapshot describes the repository at that time; subsequent
changes address several findings below. The review itself changed no application
code or database records.

## Overall assessment

ReliefOps is a substantial flood-response prototype with public help requests, SMS subscriptions, maps, shelters, volunteer profiles, coordinator tools, an admin workspace, and bilingual situation reports. Its frontend builds and passes lint, and its backend has useful validation and role gates. It is **not ready for operational emergency use**: some important actions never reach shared storage, synthetic information appears alongside live information, and several security and correctness defects remain.

The main architectural problem is the coexistence of browser-local demo state and database-backed operational state without a consistent synchronization contract. Completing that integration is more valuable than adding more screens.

## Architecture and feature coverage

| Area | Implementation | Assessment |
| --- | --- | --- |
| Frontend | React 18, React Router 6, Vite 4, Tailwind, i18next | Functional build; eager imports produce one large JavaScript bundle. |
| Backend | Express 4, Sequelize/MySQL, JWT, bcrypt, Socket.IO | Most routes validate inputs and enforce roles; authentication error handling and some write boundaries need fixes. |
| Authentication | Backend login/register first, with development or explicitly enabled mock fallback | Production mock fallback is disabled by default. Demo and backend identities still coexist in UI administration. |
| Public help requests | POST to backend, then save a browser copy | Successful submissions reach MySQL; failed submissions still receive a misleading confirmation. |
| SMS subscriptions | MySQL with a legacy JSON mirror; SSL Wireless and Twilio | Provider fallback exists; ownership verification, opt-out handling, bounded delivery, and delivery retries are incomplete. |
| Flood map | Leaflet, district GeoJSON, FFWC station overlay, socket updates | District colors start from synthetic data. Shelter API integration exists, but request/volunteer layers use local browser data. |
| Volunteer workspace | Local profile with attempted API saves; task board in React state | API save errors are ignored, existing server profiles are not loaded, and tasks are disconnected from task endpoints. |
| Coordinator workspace | Reads and changes browser-local help requests/profiles | Does not provide shared operations across devices. |
| Records workspace | Loads the first 100 server requests/profiles; mostly local edits | Only the global donation save calls a write API. No pagination UI. |
| Shelter directory | Static seed data and in-memory additions | Does not use the shelter API; additions disappear on reload. |
| Admin workspace | Browser-local users, account edits, approval/ban state, settings, risks, and audit log; real SMS endpoint | Most management controls do not change backend state. |
| Situation reports | Browser calls Anthropic with a Vite environment key | Credential exposure; should be a protected backend operation. |
| Offline support | Workbox service worker and cached district snapshot | Useful foundation, but first-visit assets and deployment updates are not reliably handled. |

## Highest-priority findings

### 1. High — Situation-report credentials are exposed to visitors

Evidence: `src/services/situationReport.js:56–70` reads `VITE_ANTHROPIC_API_KEY` and sends it directly as `x-api-key`, with direct browser access enabled. Vite embeds configured `VITE_*` values into client code. The protected route does not prevent visitors from downloading that code or recovering the key.

Move report generation to an authenticated, role-protected backend endpoint with a server-only key, request limits, and response validation. Rotate any key previously deployed in a client build. No secret values were inspected during this review.

### 2. High — Volunteers can mark their own profiles verified

Evidence: `server/routes/volunteers.js:28–31` spreads the entire request body into model creation/update. `server/models/VolunteerProfile.js:28–29` defines `verified` and `isActive`, but the route does not reserve them for operators. The request can also supply a model ID during creation.

An isolated request through the actual router returned **201 with `verified: true`** and accepted a caller-selected ID. The database method was stubbed, so no real records were changed.

Allowlist editable profile fields. Give verification and activation their own operator-only endpoints. Apply the same principle to `server/routes/helpRequests.js:34–37`: the public create route spreads the body and can accept unvalidated model fields such as `assignedToId`.

### 3. High — The seed script creates real privileged accounts with known passwords

Evidence: `server/scripts/seed.js:33–45` includes coordinator/admin demo accounts using `password`; lines 344–359 create them in MySQL unconditionally. The script has no production guard. Setting a different `SEED_ADMIN_PASSWORD` does not prevent creation of `admin@example.com` with the published demo password. It also logs the seeded primary admin password at line 340.

Separate demo seeding from production provisioning. Production initialization should require explicit credentials, avoid demo users, and avoid credential logging. Review the startup checks too: the placeholder values in `server/.env.example` pass the current checks, which reject only one particular JWT placeholder and an absent event token.

### 4. High — Backend failure still produces “Request submitted”

Evidence: `src/pages/HelpRequestPage.jsx:45–64` catches a failed POST, saves only a local copy, and sets the confirmation. Lines 95–108 then display “Request submitted” and tell the person to wait for coordinator follow-up. The coordinator on another device cannot see that local request. There is no background retry or delivery queue.

Show successful submission only after server acknowledgement. A local draft needs a distinct undelivered state, a retry action, and explicit advice for contacting emergency services. Preserve the server ID and timestamps instead of replacing server metadata in `src/data/reliefData.js:174–185`.

### 5. High — Shared relief workflows are still browser-local

Evidence:

- `src/pages/CoordinatorDashboard.jsx:56–57,124–148` loads local profiles/requests and writes assignments locally, without GET/PATCH calls to the backend.
- `src/pages/RecordsPage.jsx:122–146` saves profile/request changes locally; only the overall donation save uses the API. The per-account save button remains local.
- `src/pages/VolunteerCoordination.jsx:105–110,190–197` initializes demo tasks and changes them only in component state, without task list/accept calls.
- `src/pages/Shelters.jsx:241,305–328` uses static shelters and adds new ones only to React state.

Consequences include invisible requests on a coordinator's device, assignments that never reach volunteers, and shelter/task changes lost on reload. Use backend IDs and APIs as the shared source of truth; keep any demo mode clearly separate.

### 6. High — Admin suspension and approval controls do not enforce access

Evidence: `src/pages/AdminDashboard.jsx:573–600,642–671` updates browser-local credentials and operational flags. Neither `server/models/User.js` nor `server/middleware/auth.js` checks a ban or approval state. Mock login also ignores these flags. An account marked “Banned” can continue authenticating; creating or editing an NGO account does not provision or update its backend account.

Implement server-side user management, enforce account state on login and authenticated requests, and store an operator audit trail in shared storage. Make the UI reflect the server's result.

### 7. High — Risk calculations ignore units and station danger levels

Evidence: `server/services/waterLevelAlerts.js:12–17,110–113` applies fixed numeric thresholds to `level`; both report/event endpoints accept `m` and `ft`. The unit never reaches the risk calculation.

Isolated reproduction: **7 ft → Critical**, while the same height, **2.1336 m → Low**. Absolute river elevation also cannot reliably establish flood risk across stations with different danger levels. The FFWC adapter already uses distance from station danger level, so the two paths disagree.

Normalize units and use a station-specific reference/danger level. Preserve unit/reference metadata in district snapshots and distinguish manual assessments from automatically derived risk.

### 8. High — Map district readings are synthetic but appear current

Evidence: `src/utils/floodRisk.js:30–139` selects risk from hardcoded district lists and generates water levels by hashing district names. `src/pages/MapPage.jsx:473–501` supplies the current viewing time as “last updated” and uses these values until a socket update arrives. It does not initialize district readings from `/api/districts`; FFWC station overlays do not replace these district calculations. Admin risk edits are also a separate browser-local state.

Load persisted assessments with their real observation timestamps. Display unavailable or stale data explicitly. Restrict synthetic district values to a visibly labeled demo mode.

### 9. High — Leaflet popups interpolate unescaped data as HTML

Evidence: `src/pages/MapPage.jsx:863–869,1003–1007,1053–1059` interpolates external station data, volunteer names, and backend shelter names/addresses into `bindPopup` strings. These values can contain HTML. React's normal escaping does not apply to Leaflet HTML strings.

Build popup DOM with `textContent`, or use an appropriate sanitizer if formatted content is required. Shelter names/addresses provide a cross-user stored-XSS path, which matters because authentication tokens are in localStorage.

### 10. High — Database errors in authentication escape Express error handling

Evidence: `server/middleware/auth.js:30` awaits `User.findByPk` outside a try/catch. Express 4 does not automatically forward rejected async middleware promises to `next`.

An isolated database-failure reproduction rejected the middleware promise without calling `next`. Depending on Node's unhandled-rejection behavior, affected requests can hang or terminate the process. Catch the rejection and forward it, or consistently wrap async middleware.

### 11. High — Two volunteers can accept the same task concurrently

Evidence: `server/routes/tasks.js:104–119` reads the task, checks `Open`, then saves the assignment. There is no row lock or conditional update. Two simultaneous requests can both see `Open` and both succeed, with the last save overwriting the first assignee.

With isolated concurrent model snapshots, both requests returned **200**. Use a conditional update constrained by `status = 'Open'`, or a transaction and row lock. The losing request should receive 409, and only the successful assignment should emit an event.

### 12. High — Public donation instructions silently fall back to demo accounts

Evidence: `src/pages/DonationPage.jsx:8–23` starts with `getDonationAccounts()`, replaces them only when the API returns a nonempty collection, and otherwise retains the local/default accounts. `src/data/reliefData.js:5–45` contains realistic-looking demo payment details. Even a valid empty API response leaves these instructions visible.

Do not show example accounts as live donation destinations. Render an unavailable/empty state when verified accounts cannot be loaded, and mark all demo payment information explicitly.

## Additional correctness and reliability findings

### 13. Medium — Missing FFWC readings become zero

Evidence: `server/routes/ffwc.js:131–145` calls `Number()` on cell text. `Number('')` is zero, so missing observations and forecasts are accepted as valid zero readings. A synthetic report with blank cells reproduced both results. This can falsely suggest sharply falling water or a low-risk station.

Reject blank/missing values before numeric conversion; preserve missing forecasts as null and select the latest actual observation. Add parser fixtures, including missing values and year boundaries. The legacy upstream report is also fetched over HTTP; prefer a verified HTTPS source where available.

### 14. Medium — Profile saves falsely succeed and ordinary photos exceed the API limit

Evidence: `src/pages/VolunteerCoordination.jsx:130–143` marks a profile saved before the request completes and ignores HTTP failure statuses. It also never GETs `/api/volunteers/me`. Registration profile details in `src/pages/AuthForm.jsx:99–113` are initially saved only locally.

`server/index.js:50` permits only 128 KB JSON while `server/routes/volunteers.js:19` allows a 5,000,000-character image. A 140 KB image payload returned **413** in the isolated check. Load server profiles, await successful writes, and use controlled image upload/storage with size validation or resizing.

### 15. Medium — SMS subscription ownership and opt-out are incomplete

Evidence: `server/routes/alerts.js:259–271` lets anyone unsubscribe a known phone without authentication or proof of possession. Public subscription can also change that phone's target district/upazila without verification. Confirmation texts promise “Reply STOP,” but there is no inbound SMS/STOP handler in the repo. `src/pages/GetAlerts.jsx:75–82` ignores `confirmationSms`, so confirmation-delivery failure is not surfaced as the backend README claims.

Verify phone ownership, use signed opt-out links or a validated provider webhook, and distinguish subscription storage from message delivery.

### 16. Medium — Alert persistence and SMS delivery are not reliably coordinated

Evidence: `server/services/waterLevelAlerts.js:199–251` uses recent alert creation as the delivery cooldown, then sends SMS after creating/broadcasting the alert. Failed SMS can therefore be suppressed on retry; even a manual alert of the same district/severity can suppress automatic delivery. `server/services/smsGateway.js:26–83` has no request timeout, and both send paths use unbounded `Promise.all` fan-out.

Use a persistent outbox/job queue with delivery-specific idempotency, bounded concurrency, provider timeouts, and retry status. Keep failed deliveries eligible for retry. Track old/out-of-order observations before overwriting district state (`waterLevelAlerts.js:152–171`).

### 17. Medium — Initial alert loading is one-shot and can show an older alert last

Evidence: `src/services/currentAlerts.js:45–65` sets `loaded: true` even when both initial requests fail, preventing retry. `src/components/GlobalWebsiteAlert.jsx:207` loops over the returned alerts and replaces the active alert each time. Since `/api/alerts` returns newest first, an older warning can overwrite the newest one; severity is not prioritized either.

Select the highest-priority relevant active alert, retry failed initial loads, and refresh after socket reconnect. Define deduplication across the persisted and in-memory alert feeds.

### 18. Medium — Offline startup and updates need a build-aware cache manifest

Evidence: `public/sw.js:11–21` precaches HTML routes with `revision: null`, but does not precache compiled JavaScript/CSS. `src/registerServiceWorker.js:6–9` installs after page load, so assets fetched before the first service worker controls the page are not guaranteed cached. Unversioned precached HTML can retain an older shell across releases. Multi-megabyte GeoJSON is precached too.

Generate a revisioned asset manifest from the production build, include required compiled assets, and test offline behavior immediately after first installation and after a deployment. Runtime caching alone does not guarantee first-visit offline boot. No production offline-browser test was performed in this review.

### 19. Medium — Deployment configuration does not connect the frontend by default

Evidence: `src/services/socket.js:3` defaults to `http://localhost:3000`; on a deployed site this targets each visitor's own computer, and an HTTPS page also needs a compatible secure socket URL. `vite.config.js` proxies API/auth/event paths only in development; the Express app does not serve the built frontend. Root `package.json:8` starts `node server/index.js`, but dotenv resolves `.env` from the working directory, whereas the supplied configuration lives in `server/.env`.

Document and provide the production reverse proxy/static hosting setup, use a configured or same-origin socket endpoint, and resolve server configuration explicitly. Consider a readiness endpoint that fails when the database is unavailable rather than relying on `/health` returning 200 with `ok: true`.

### 20. Medium — Records silently stop at 100, and admin review excludes volunteer controls

Evidence: `src/pages/RecordsPage.jsx:57–58` loads only the first 100 profiles/requests despite paginated backend APIs. There is no pagination control. Line 50 restricts volunteer management to coordinators, and the section at line 172 is hidden from admins even though the advertised records workflow includes admins.

Add pagination/filtering and resolve the intended admin permissions. Otherwise operators can miss older unresolved cases while believing they are seeing all records.

## Dependency, performance, and maintainability assessment

- Root lockfile audit: **27 affected packages** — 1 critical, 15 high, 7 moderate, 4 low.
- Server lockfile audit: **11 affected packages** — 1 critical, 5 high, 5 moderate.
- These sets overlap and should not be added together. Audit severity does not establish exploitability in this particular app. The critical advisory concerns `proxy-addr`; this app does not currently enable Express `trust proxy`, which limits that specific exposure. Socket.IO/Engine.IO/parser and `ws` advisories deserve attention because the realtime listener is exposed. Vite advisories concern development tooling as well as the dependency maintenance burden.
- Upgrade deliberately and verify compatibility. Do not blindly apply the audit's suggested Sequelize downgrade/major change.
- Production output is **638.10 KB JavaScript** (189.86 KB gzip) and **78.60 KB CSS** (19.11 KB gzip). All pages are eagerly imported by `src/App.jsx`; lazy-load route workspaces and expensive map features.
- District GeoJSON is approximately **18 MB**. Simplify boundaries for screen display and use compression/cache headers. This is a substantial first-load and offline-cache cost on constrained networks.
- `Home.jsx` and `AdminDashboard.jsx` are each about 1,480 lines; `MapPage.jsx` is 1,360. Extract data adapters and operational mutations before splitting presentational components, so refactoring also eliminates duplicated data logic.
- No automated test suite or CI workflow was found. Useful initial coverage: authorization field boundaries, task races, help-request delivery states, unit conversion, FFWC parser fixtures, and production offline startup.
- English/Bangla translation infrastructure exists, but several newer operational screens and status messages are hardcoded English. Review those flows with Bangla enabled.
- The development database viewer is guarded against production mounting, but is unauthenticated when enabled and renders complete table rows, including sensitive user data. Restrict it to an explicitly local environment or an authenticated operator role.
- `server/.env` is ignored and not tracked. `server/data/subscribers.json` is tracked; prevent real subscriber names/phone numbers from entering Git through the runtime mirror.
- README documentation is behind the implementation: authentication now attempts the backend first; production hosting, frontend environment requirements, and the boundaries of demo workflows need a clear explanation.

## Verification performed and limits

| Check | Result |
| --- | --- |
| `npm run build` | Passed; large-chunk warning and stale Browserslist data warning. |
| `npm run lint` | Passed. |
| Root and server `npm audit --json` | Completed; vulnerable package counts above. |
| Actual volunteer router with stubbed database creation | Accepted `verified: true` and a caller-selected model ID. |
| Actual task router with simultaneous independent model snapshots | Both acceptance requests returned 200. |
| Authentication middleware with simulated database outage | Rejection was not forwarded to Express. |
| Water-risk function with equivalent feet/metres values | Different risk classifications. |
| Actual FFWC parser with blank cells | Missing latest/forecast values became zero. |
| Profile request at the configured JSON limit | 140 KB payload rejected with 413. |
| Browser smoke check | Homepage rendered at desktop width; map rendered 64 district paths at 390 px mobile width, without horizontal page overflow. |

The browser check ran with no backend listening on port 3000: API proxy failures and refused socket connections were observed. These are environment-dependent smoke-test results, not proof that configured MySQL/SMS integrations fail. Live MySQL persistence, actual SMS delivery, external AI generation, exhaustive accessibility, and production offline recovery were not exercised. Database operations were stubbed for isolated checks; no external messages were sent.

## Recommended implementation order

1. Close credential and write-boundary defects: server-side situation reports, profile field allowlists, production-safe provisioning, safe popups, and authentication error forwarding.
2. Complete shared operations: backend-backed coordinator requests, volunteer profiles/tasks, shelters, donation editing, user administration, and truthful delivery confirmations.
3. Make warning data trustworthy: unit/reference handling, actual district snapshots and observation times, robust FFWC parsing, and prioritized/retried alert loading.
4. Make delivery reliable: atomic task acceptance, SMS outbox/retries/opt-out verification, and production/offline deployment configuration.
5. Add focused regression checks and CI, then update dependencies and reduce initial payloads.
