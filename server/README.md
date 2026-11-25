# ReliefOps backend

Express + Socket.IO + Sequelize (MySQL) server. Hosts:

- A JWT-secured REST API with role-based access control
- The realtime relief operations feed (`/health`, `/events/*`, Socket.IO at `/`)
- The public SMS alerts API at `/api/alerts/*` (subscribe / send)

## Setup

```powershell
cd server
npm install
copy .env.example .env
# 1. fill in DB_* credentials, JWT_SECRET, and (optionally) SMS_PROVIDER creds
# 2. create the database:  mysql -u root -p -e "CREATE DATABASE reliefops;"
# 3. seed districts + admin: npm run db:seed
# 4. start the API:          npm run dev
```

The server defaults to `http://localhost:3000`. Set `PORT` in `server/.env`
to use a different port. The Vite dev proxy reads that same setting for
`/api/*`, `/auth/*`, `/health`, and `/events/*` (see `vite.config.js`).

ReliefOps uses MySQL for local development and production. Configure
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` in `server/.env`
before seeding or starting the backend.

### Sample operational data

With MySQL connected, run `npm run db:seed:demo` from `server/`. This inserts
clearly labeled development users, volunteer profiles, requests, receipts,
shelters, field tasks, alerts, water reports and an audit entry. The sample
payment account is inactive. Subscriber records and existing operational
records are preserved; this script does not send SMS or email.

The initial sample receipts total **BDT 325,500**, excluding one refunded
receipt. Completed sample requests record **23 families helped**. These are
development examples, not actual donations or assistance outcomes.

Sample sign-in accounts are `demo.admin@example.test` (admin) and
`demo.coordinator@example.test` (NGO coordinator). Their initial password is
`DemoRelief!2026`, or `SEED_DEMO_PASSWORD` when configured before seeding.
The script uses stable keys and a transaction: rerunning it does not duplicate
receipts or overwrite passwords, operator edits, or outcomes. It refuses to
run with `NODE_ENV=production`.

It also creates the development accounts listed in the main README:
`admin@example.com`, `coordinator@example.com`, and `volunteer@example.com`.
Their initial password is `password`, or `SEED_DEMO_PASSWORD` if configured.
Existing accounts keep their passwords, approval and suspension state; a
conflicting existing role causes the seed transaction to roll back.

## REST API overview

All `/api/*` endpoints return JSON. Protected endpoints require an
`Authorization: Bearer <token>` header obtained from `/auth/login` or
`/auth/register`.

### Roles

| Role          | Permissions                                                   |
|---------------|---------------------------------------------------------------|
| `admin`       | Everything                                                    |
| `coordinator` | Create alerts, tasks, shelters; accept tasks                  |
| `volunteer`   | Accept tasks, file water-level reports                        |
| `citizen`     | Read public endpoints, default for new sign-ups               |

### Auth

| Method | Path             | Auth | Body                                            |
|--------|------------------|------|-------------------------------------------------|
| POST   | `/auth/register` | -    | `{name, email, password, phone?, role?, districtId?}` |
| POST   | `/auth/login`    | -    | `{email, password}`                             |
| GET    | `/auth/me`       | yes  | -                                               |

Public registration is restricted to citizen and volunteer accounts.
Coordinators and admins must be provisioned by an administrator or the seed script.

### Resources

| Method | Path                          | Role gate                       |
|--------|-------------------------------|---------------------------------|
| GET    | `/api/districts`              | public                          |
| GET    | `/api/shelters`               | public                          |
| POST   | `/api/shelters`               | admin, coordinator              |
| GET    | `/api/tasks`                  | any authenticated user          |
| POST   | `/api/tasks`                  | admin, coordinator              |
| PUT    | `/api/tasks/:id/accept`       | volunteer, coordinator, admin   |
| POST   | `/api/reports/water-level`    | volunteer, coordinator, admin   |
| GET    | `/api/alerts`                 | public                          |
| POST   | `/api/alerts`                 | admin, coordinator              |
| POST   | `/api/help-requests`           | public (rate limited)           |
| GET    | `/api/help-requests`           | admin, coordinator              |
| PATCH  | `/api/help-requests/:id`       | admin, coordinator              |
| GET    | `/api/volunteers`              | admin, coordinator              |
| GET/PUT| `/api/volunteers/me`           | authenticated                   |
| GET    | `/api/donations`               | public                          |
| PUT    | `/api/donations`               | admin, coordinator              |

`POST /api/reports/water-level` also updates the target district's current
risk snapshot, emits a `water_level_update` Socket.IO event, and — when the
derived risk is `Critical` — auto-creates and broadcasts an alert.

`PUT /api/tasks/:id/accept` is idempotent-rejecting: a non-`Open` task
returns 409 instead of silently overwriting an assignment.

## SMS alerts API

### POST `/api/alerts/subscribe`

Public endpoint used by the `/alerts` page.

Request body:

```json
{
  "phone": "01712345678",
  "district": "Sylhet",
  "upazila": "Sylhet Sadar",
  "name": "Optional name"
}
```

The phone number is normalised to `8801XXXXXXXXX`. The subscriber is upserted
into MySQL, mirrored to the legacy JSON store, and a confirmation SMS is sent
through the configured gateway.

Response (201):

```json
{
  "ok": true,
  "subscription": { "phone": "8801712345678", "district": "Sylhet", "upazila": "Sylhet Sadar", ... },
  "confirmationSms": { "provider": "ssl-wireless", "messageId": "..." }
}
```

If the gateway fails, the subscription is still saved and `confirmationSms`
is `null` — the frontend surfaces a soft warning.

### POST `/api/alerts/send`

Broadcasts an alert. Either filter by `district` / `upazila` to target stored
subscribers, or pass an explicit list of `phones`.

```json
{ "message": "Water level at Sylhet exceeded danger mark.", "district": "Sylhet" }
```

```json
{ "message": "Test SMS", "phones": ["01712345678", "8801812345678"] }
```

Returns per-recipient delivery status:

```json
{ "ok": true, "sent": 3, "failed": 0, "total": 3, "results": [...] }
```

### GET `/api/alerts/subscribers?district=&upazila=`

Lists active subscribers. Requires an admin or coordinator bearer token.

## SMS gateway

`services/smsGateway.js` integrates two providers:

- **SSL Wireless BD** (`smsplus.sslwireless.com/api/v3/send-sms`) — primary.
- **Twilio** — automatic fallback when SSL Wireless fails, or primary if you
  set `SMS_PROVIDER=twilio`.

When no credentials are configured the gateway runs in dry-run mode and only
logs the outgoing SMS, so the UI flow can be exercised end-to-end without a
provider account.

Selection rules:

| Env state                                | Behaviour                                |
|------------------------------------------|------------------------------------------|
| `SMS_PROVIDER=ssl` + SSL creds set       | SSL primary, Twilio fallback             |
| `SMS_PROVIDER=twilio` + Twilio creds set | Twilio primary, SSL fallback             |
| No env set, SSL creds present            | SSL primary, Twilio fallback             |
| No env set, Twilio creds present         | Twilio primary, SSL fallback             |
| Nothing configured                       | Dry-run (logs `[sms:dryrun] -> +88...`)  |

## Storage

Operational records are persisted in MySQL through Sequelize. This includes
users, districts, shelters, tasks, water reports, alerts, help requests,
volunteer profiles, donation accounts, and SMS subscribers.

The existing `server/data/subscribers.json` file is retained as a legacy
mirror. Its records are imported into MySQL at server startup, so existing
mock data is preserved. Runtime queries and SMS targeting use MySQL.

To inspect stored records directly from the project:

```bash
npm run db:query -- help-requests --limit=20
npm run db:query -- volunteers --limit=20
npm run db:query -- donations
npm run db:query -- subscribers
```

Available query resources are printed when `npm run db:query` is run without
a resource name. API collection routes support pagination through `page` and
`limit` where applicable.

Production startup requires `JWT_SECRET`, `CLIENT_ORIGIN`, and
`WATER_LEVEL_EVENT_TOKEN`. Public write endpoints are rate limited and
subscriber/operator endpoints require an admin or coordinator JWT.

## Homepage impact statistics and donation ledger

`GET /api/impact-stats` is public and returns aggregate totals from MySQL:

```json
{
  "donationsTaka": "4820000.00",
  "familiesHelped": 12430,
  "activeVolunteers": 1284,
  "reliefCampsOpen": 76,
  "updatedAt": "2026-11-23T00:00:00.000Z"
}
```

These are example response values, not seeded records. The homepage loads this
endpoint, refreshes every minute and on window focus, and animates the first
result. While the backend is unavailable, the frontend shows labeled mock totals
and donation entries and retries every 15 seconds. Successful datastore responses
replace these previews, including genuine zero totals and an empty ledger. Mock
data is read-only frontend data and is never inserted into MySQL.

- **Taka donated:** the sum of `donation_receipts.amount` with status `Received`.
  Amounts are stored as `DECIMAL(14,2)` in BDT; refunded receipts are excluded.
- **Families helped:** the sum of the operator-entered `help_requests.families_helped`
  on `Completed` requests. This counts recorded family-support outcomes across
  cases, not deduplicated households. Existing records default to zero until an
  operator records their outcome; `people_count` is not treated as a family count.
- **Active volunteers:** active volunteer profiles linked to a user with role
  `volunteer`, irrespective of current availability.
- **Relief camps open:** shelters with `is_active = true`, including full camps.

NGO/admin users can record receipts and supported-family counts on `/records`.
The new receipt endpoints require an admin or coordinator JWT:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/donations/receipts?page=1&limit=25` | Paginated private ledger |
| POST | `/api/donations/receipts` | Record a confirmed receipt |
| PATCH | `/api/donations/receipts/:id` | Set `status` to `Received` or `Refunded` |
| PATCH | `/api/help-requests/:id` | Save `familiesHelped` and request `status` |

Receipt creation accepts `amount` (prefer a decimal string), `reference` (unique
transaction ID or receipt number), `channel` (`Cash`, `bKash`, `Nagad`, `Bank transfer`,
or `Other`), and optional `donorName`, `receivedAt` (ISO timestamp), and `notes`.
Duplicate references return 409. The server records the operator; the public
statistics response never includes donor names, payment references, or contacts.
This ledger records money already received; payment collection remains external.

Safe/alter/force database startup applies the targeted, idempotent impact migration.
For `DB_SYNC=off`, or to migrate an existing database separately, run from `server/`:

```bash
npm run db:migrate:impact
npm run db:query -- donation-receipts --limit=20
npm test
```

The migration creates the receipt table and adds `families_helped` if absent,
without resetting existing data. API tests use isolated model stubs and do not
write to the configured database.

### Live donations

The homepage's live donations card reads `GET /api/donations/live?limit=4`.
The public endpoint returns the newest `Received` receipts, with only `id`,
`displayName`, `amount`, and `receivedAt`. The maximum requested limit is 20.
Refunded receipts, private notes, transaction references, and operator details
are excluded.

Receipts have `isAnonymous: true` by default. The same migration adds
`is_anonymous` to existing ledgers with a true default, keeping earlier donor
names private. Operators can choose anonymity when recording a receipt or
change it later on `/records`. When anonymity is disabled, the public feed
shows the first name and last-name initial (for example, `Rahim U.`).
Blank donor names remain anonymous.

Receipt creation and status/privacy changes emit the public `donation_update`
Socket.IO event containing only an update timestamp. The card reloads on that
event and reconnect, and polls every 15 seconds as a fallback. Time labels use
the receipt's actual received timestamp and support English and Bangla.

## Admin and NGO dashboards

The approved dashboard layout is implemented at `/admin/dashboard` and
`/coordinator`, with a responsive sidebar and route-based views for requests,
volunteers, donation records, alerts, and activity. `/dashboard` redirects to
the admin overview. The shared Records page now saves donation account settings
through the backend rather than treating a browser-local copy as authoritative.

`GET /api/dashboard/overview` requires an admin or approved coordinator JWT.
It accepts `districtId`, `status`, `page`, and `q`, returns genuine summaries,
seven donation days in Bangladesh time, paginated requests, eligible volunteers,
and recent donation receipts. NGO callers do not receive the admin account list
or audit history. Demo mode uses read-only examples when the backend is
unavailable; API authentication/permission errors require a valid sign-in and do
not turn into a writable demo session.

| Method | Path | Access / effect |
| --- | --- | --- |
| POST | `/api/dashboard/ngos` | Admin creates a pending coordinator account with a hashed temporary password |
| PATCH | `/api/dashboard/ngos/:id` | Admin approves, suspends, or restores coordinator access |
| GET | `/api/dashboard/volunteers/:userId` | Admin/coordinator reads volunteer registration details; response is not cached |
| PATCH | `/api/dashboard/volunteers/:userId` | Admin/coordinator verifies or suspends a volunteer |
| PATCH | `/api/help-requests/:id` | Saves assignment/outcome with an audit entry in the same transaction |

New `users.is_active` and `users.approval_status` fields are enforced on login
and on every protected request. Existing accounts are migrated as active and
approved to preserve legitimate access. New coordinator accounts start pending.
Profile owners cannot write `verified`, `isActive`, IDs, or another user's email.
Assignment requires an active, verified, available volunteer. Task acceptance
requires volunteer approval and uses a conditional update to prevent two users
accepting the same open task.

Normal database synchronization runs the targeted dashboard migration. With
`DB_SYNC=off`, run this from `server/` before starting the updated API:

```bash
npm run db:migrate:impact
npm run db:migrate:dashboard
npm test
```

The migration also creates `audit_entries`. Dashboard tests use isolated model
stubs; they do not mutate the configured datastore or send external messages.
The request report export contains the currently loaded request rows, and escapes
spreadsheet formula prefixes in user-entered values.
