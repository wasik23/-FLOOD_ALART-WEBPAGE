# ReliefOps

ReliefOps is a flood early warning and relief coordination web app. It helps the public request help without an account, lets volunteers register for field work, and gives NGO/admin users protected tools to manage records, shelters, alerts, maps, and donation information.

## Key Features

- Public landing page with flood updates, water level outlook, donation links, and contact information
- No-login public help request form
- SMS alert subscription by district and upazila
- Volunteer registration with photo, phone, address, guardian contact, skills, and location
- NGO/admin records page for volunteer profiles, public help requests, and donation account details
- Protected role-based workspaces for volunteer, NGO/coordinator, and admin users
- Bangladesh district map, shelter directory, admin controls, and realtime alert/task socket hooks

## Development

```bash
npm install
npm run dev
```

The frontend runs with Vite. The optional backend is in `server/` and provides REST, Socket.IO, auth, SMS subscription, and database-backed relief operations APIs.

## Emergency Alert Test

Open this URL while the frontend is running to preview a critical flood alert for Kurigram:

[Critical flood alert test](http://localhost:5173/?emergency=critical&district=Kurigram&level=8.9%20m)

Click once on the page to enable the alert sound.

## Demo Access

Sign-in uses the backend and MySQL when the server is available. To create
the documented development accounts, run `npm --prefix server run db:seed:demo`:

- `volunteer@example.com`
- `coordinator@example.com`
- `admin@example.com`

Initial password: `password` (or `SEED_DEMO_PASSWORD` if configured before
seeding). Rerunning the seed preserves existing passwords and account access
settings. These accounts also support the development-only offline auth fallback.

Additional `demo.*@example.test` sample accounts are documented in
[server/README.md](server/README.md#sample-operational-data).

## Impact totals

The homepage statistics come from the backend's public `/api/impact-stats`
endpoint and MySQL. NGO/admin users record received donation receipts and the
actual families supported on completed help requests at `/records`. Active
volunteer profiles and active shelters supply the remaining counts. Totals
refresh every minute and when the window regains focus. When the backend is
unavailable, labeled mock totals and donation entries are shown, with automatic
connection retries every 15 seconds. Successful responses replace the mock data,
including real zero totals and an empty donation ledger.

The backend creates the donation ledger and adds the families-helped field during
normal database startup. `npm run server` starts the backend from its own directory
so it reads `server/.env`. With `DB_SYNC=off`, run `npm run db:migrate:impact` from
`server/` before deploying this version. See [server/README.md](server/README.md)
for the metric definitions, receipt API, and test command.

The live donations card below the totals shows the latest four received
donations, their public donor names and relative received times. It refreshes on
donation events and every 15 seconds. Receipts default to anonymous; NGO/admin
users control name visibility in the donation ledger at `/records`.

## Admin and NGO dashboards

The admin overview (`/admin/dashboard`) includes donation trends, flood
assessments, NGO approvals, and audit history. The NGO overview (`/coordinator`)
includes request triage, verified available volunteers, field updates, and
families-supported outcomes. Both use backend records when available and
read-only demo data while offline. Actual write actions require an authenticated
backend connection.

With `DB_SYNC=off`, run `npm run db:migrate:dashboard` from `server/` in addition
to the impact migration. This adds account approval/suspension fields and the
shared audit log. See [server/README.md](server/README.md) for API and migration
details.
