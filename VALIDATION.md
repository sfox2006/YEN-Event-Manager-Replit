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
