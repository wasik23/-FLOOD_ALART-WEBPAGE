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

## Demo Access

The current frontend still uses local demo authentication while backend integration is completed.

- `volunteer@example.com`
- `coordinator@example.com`
- `admin@example.com`

Password: `password`
