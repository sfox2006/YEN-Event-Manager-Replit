# Validation results

Verified in this cloud checkout on 8 October 2026 with Node 22.22.0:

- Frozen `npm ci --include=dev` installation: passed. The saved complete installation script was executed successfully, including type check, tests and build.
- `npm run typecheck`: passed.
- `npm test`: **24 passed** across two suites (21 domain/storage/cache tests and 3 mocked Apps Script contract tests). The domain suite also passed under `TZ=America/Los_Angeles` to exercise local/UTC midnight differences.
- `npm run build`: passed. Vite reports the optional ExcelJS chunk is larger than 500 kB; it is dynamically imported for export.
- `npm run test:e2e`: **16 passed**, covering desktop 1440 and mobile 390. The affected creation/edit/dirty-navigation/deadline workflows were rerun after final accessibility and task-order refinements.
- Production Express `/`, `/api/health` and `/api/config`: HTTP 200. Unknown API path: JSON 404. Unsupported proxy action: HTTP 400. API responses: `Cache-Control: no-store`.
- Production browser: dashboard, event deep-link reload and offline shell/navigation passed; no JavaScript console errors and no external demo data requests. Service-worker cache contained local assets and no API responses.
- Dashboard screenshot visually reviewed against the supplied study's navy header, cards, calendar and tables.
- Optional Apps Script source passes JavaScript syntax validation. Mocked tests exercise schema size/read joins, mutation dispatch, automation retry/cascade and three-way merge. These mocks do not validate Google services or deployment permissions.

Browser tests cover all seven main routes, navigation/mobile overflow, calendar overflow, name-only event creation, child save/reload, task save while parent remains dirty, workbook worksheet names, deletion cancellation/cascade, automation preview and generation, template deactivation/deletion preserving generated tasks, inline status, AND filters, bucket tabs, note-file upload/replacement, dirty-route cancellation, member inactivation preserving history, date recalculation decline/accept/Complete exclusion, and independent browser IndexedDB persistence.

Playwright's browser download was denied by the current cloud network policy. Tests passed using the already installed `/usr/bin/chromium` with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. No TLS verification was disabled or network policy bypassed.

**External limits:** Google Sheet/Apps Script deployment, authorization, live CRUD, Drive upload/sharing and phone installation were not exercised. There is no Replit project or public app URL yet; `.replit` and README prepare GitHub import and Autoscale publication. GitHub push does not publish Replit. Publishing and public-URL validation require the user's Replit account/project.

## Workbook import update

The production seed is now empty. Synthetic fixtures exist only in tests. Existing seed-version-1 browsers remove seeded records and retain a local backup plus newly created records. Settings imports a complete dashboard workbook locally; records are never sent to the app server or committed into its public bundle.

Verified the supplied workbook in an isolated production browser: all **136 records** imported and persisted across reload (3 events, 6 speakers, 6 speaker links, 12 posters, 12 tasks, 19 templates, 1 meeting, 6 members, 18 attendances, 4 organisations, 2 event-organisation links, 5 funding rows, 3 venues, 39 checklist rows). The shifted meeting status/agenda fields were repaired, missing timestamps were reported, start time remained 19:00, and an imported event saved successfully with no console errors or synthetic events. Original IDs/dates/contacts/links are preserved. This validates a local browser import, not an update to the user's Replit browser or shared Google backend.

Updated checks: 30 domain/storage/import/backend tests passed; 17 of 18 browser tests passed initially, and the one failing template-action race was fixed and both desktop/mobile variants passed on rerun. Type checking and production build passed. Live Replit publication remains external.

## Task reminder update

Added member announcements and email-draft links to task actions on Tasks and event workspaces. Verified 36 domain/import/storage/backend tests and six targeted desktop/mobile browser checks, including reminder persistence, member filtering, read/unread status, generated mailto recipient/subject/body, existing navigation and independent event-task saves. Production build/type checking and Apps Script JavaScript syntax checks passed. Shared reminder actions are covered by mocked Apps Script contract tests; live Google persistence and the user's OS/browser email handler were not exercised. No email was sent during validation.

## Replit authentication preparation

Inspected Internship Hub GitHub commit `6168f4f`: its browser entry is an explicit local demo, while administrator authorization is prepared but not connected to Replit Auth. Adopted the exact verified-ID/fail-closed administrator contract and added an Account page, a trusted server-session adapter contract, and protected data middleware enabled by an installed adapter or `APP_AUTH_MODE=replit`. Default local operation is retained; no real authentication is claimed before provisioning.

42 unit tests pass, including six identity/authorization tests. Eight targeted desktop/mobile browser checks cover existing routes/reminders, honest unconfigured Account state, denied anonymous admin access and Account reachability when data is unavailable. HTTP checks using a mocked server identity adapter verified missing-provider 503, anonymous/spoofed data access 401, non-owner 403, owner access, owner revocation and cleared-session denial. Type checking and production build pass. Real Replit provider callbacks, durable sessions, verified owner binding, membership authorization, shared account-linked storage and publication require the Replit Agent steps in docs/REPLIT-AUTH-SETUP.md; they were not live-tested or provisioned here.
