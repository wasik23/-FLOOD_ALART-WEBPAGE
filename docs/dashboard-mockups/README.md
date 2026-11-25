# Dashboard redesign proposal

These are approval previews for the admin and NGO dashboards. The HTML is
standalone; it does not replace the application pages or write operational data.
All names, totals, alerts and records in the PNGs are illustrative.

- `admin-dashboard.png`: platform overview, confirmed donation trends, district
  warnings, NGO approval queue and recent donation receipts.
- `ngo-dashboard.png`: response overview, priority request queue, verified
  available volunteers, field reports and a families-supported completion form.
- `admin.html`, `ngo.html`, `dashboard.css`: editable sources for the previews.

The direction uses a persistent forest-green sidebar, a light workspace,
compact metrics, action tables, and restrained status colors. On mobile, the
sidebar collapses and wide tables scroll within their own panels.

## Findings that informed the proposal before implementation

1. Admin account creation, password changes, approvals, suspension, risk edits,
   owner settings and audit logs are currently browser-local. These controls
   need corresponding protected backend actions to become operational.
2. NGO credentials are stored and displayed as plaintext. The proposal replaces
   the password table with invitation/review actions and account state.
3. Approval/suspension flags do not gate demo authentication. An isolated check
   confirmed an unapproved, banned demo coordinator could still log in. Backend
   user state also has no approval/suspension fields to enforce this workflow.
4. The NGO triage page makes no backend requests. Assignments and completion
   changes stay in localStorage, while the newer Records page saves outcomes
   and donation receipts to MySQL. The dashboards can therefore disagree.
5. NGO statuses `Verified`, `In progress` and `Need backup` are unsupported by
   the backend. The proposal's request queue uses Pending/Assigned, with
   separate priority indicators and an explicit completion outcome.
6. The NGO board writes `assignedVolunteerId`; the backend expects
   `assignedToId`. The UI also counts completed cases as assigned when the
   assignment ID remains set. The proposal separates active work from outcomes.
7. An inactive volunteer appeared in the NGO available list during a fixture
   check. The redesigned roster should require active, approved volunteers and
   matching availability before assignment.
8. The current admin page overflowed to 1,098 px at a 390 px viewport. The
   preview layouts were checked at 390 px and have no page-level overflow.

The current admin map density is generated from district-name hashes, its SMS
counter starts with a demo baseline, and health checks run only on mount. The
future dashboard should label demo mode, use actual aggregates/assessments,
refresh service state, and keep audit history in shared storage.

The user approved these designs. The application now implements the layout with backend-connected controls and read-only offline previews. The PNGs remain the original design references.
