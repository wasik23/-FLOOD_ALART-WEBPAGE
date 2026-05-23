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

The server listens on `http://localhost:3000`. The Vite dev server proxies
`/api/*` to it (see `vite.config.js`).

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

`role` on registration is restricted to non-admin values; admins must be
created via the seed script.

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
into `server/data/subscribers.json` and a confirmation SMS is sent through
the configured gateway.

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

Lists stored subscribers (intended for operator use; protect before
production exposure).

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

Subscribers are persisted to `server/data/subscribers.json`. The file is
created on first write and writes are serialised through a promise chain to
prevent interleaved JSON writes. Swap this out for a real database before
production use.
