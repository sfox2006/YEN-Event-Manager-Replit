# YEN Event Manager

A rebuilt organising committee tracker based on the supplied dashboard study and three build prompts. Local browser storage is the default; no simulated records are created. The app has no login or permission roles.

## Run and check

Use Node **22.12+ on the Node 22 line** (`.nvmrc` is `22`; Replit uses `nodejs-22`).

```sh
npm ci --include=dev
npm run dev
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Stop the development server before starting production: both use one Express listener on `0.0.0.0:3000`. Development attaches Vite middleware to Express, with trusted localhost, `.replit.dev` and `.replit.app` hosts. Production serves the absolute `dist` directory. On cloud machines with installed Chromium, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e` is supported. Browser downloads require `cdn.playwright.dev` or `playwright.download.prss.microsoft.com`; Linux browser libraries may require `npx playwright install-deps chromium`.

## Pages

- `#/dashboard`: global metrics, Sunday-first six-week calendar, upcoming events and meetings.
- `#/events`: upcoming/past/cancelled history and AND filters.
- `#/event/<id>`: basic details, funding, speakers, poster links, venue, organisations, attendance, independent tasks, checklist, conflict-aware save, Excel and cascade deletion.
- `#/meetings`: meetings, inline status, notes links and PDF/DOC/DOCX uploads.
- `#/tasks`: status-grouped tasks, global cards and filters.
- `#/committee`: active and historical organising members.
- `#/organisations`: active and archived partners.
- `#/settings`: phone installation guidance and editable task templates.

## Configuration and storage

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_DATA_MODE` | `demo` | `demo` or explicitly configured `google` |
| `PORT` | `3000` | Single listener; Replit mapping must match any override |
| `GOOGLE_APPS_SCRIPT_URL` | empty | Required only in Google mode; HTTPS `script.google.com/macros/s/<deployment>/exec` URL |

No secrets or database provisioning are needed for local browser storage. Local `.env` is optional; see `.env.example`. Configuration is server-only; never use a `VITE_` variable for credentials. `/api/health` returns `{ok:true}` independent of Google; `/api/config` exposes only the selected mode. API responses are `no-store`.

Local records and uploaded note blobs live in transactional **IndexedDB, per browser/profile/origin**. Fresh browsers start empty. Go to **Settings → Import dashboard workbook**, choose the complete 14-table `.xlsx`, review record counts and repairs, then select **Replace records with workbook**. This replaces records and local note uploads only in that browser. The workbook is parsed locally and is not sent to the server or included in public source/bundles. IDs, relationships, saved dates, valid timestamps, contacts, notes and external links are retained. Blank optional numeric fields stay absent. The known shifted legacy meeting status/agenda row is repaired; missing timestamps are explicitly reported and set to import time. Invalid IDs/references or incomplete workbooks fail before any replacement.

Existing version-1 installations automatically remove the known synthetic seed IDs, retain newly created records (tasks attached to removed sample events become general tasks), and keep a local record backup under `before_synthetic_removal`. Imports keep a pre-import record backup under `before_workbook_import`. Backups stay in the browser; they are not server or cloud backups. Import once on your published origin; Preview, private profiles and different visitors have separate records. Do not clear IndexedDB to update a shell cache. The legacy server setting `APP_DATA_MODE=demo` still selects the local adapter for compatibility, but the UI no longer describes your real imported data as synthetic. A full dashboard workbook is required; a single-event Excel export has fewer sheets and cannot be used for this import.

The Google adapter uses the server's fixed, allowlisted action proxy with a 20-second timeout, validated envelopes and a 16 MiB JSON request limit (base64 expands an 8 MiB file). Invalid Google mode configuration fails clearly rather than falling back to demo. The endpoint is absent from client configuration and bundles.

## Rules

Readiness is the rounded passed/total check percentage: date, lead, funding unless explicitly No (Confirmed or N/A passes), venue unless explicitly No (Confirmed or Not required passes), one all-confirmed check for relevant speakers excluding Declined/Withdrawn, and each **saved** checklist row except Not applicable. Tasks, posters, attendance and budgets are not extra checks. Unsaved checklist placeholders are persisted only on Save all changes.

Cancelled takes precedence in event/meeting buckets, then Completed is past regardless of date. Otherwise dates before **browser-local today** are past; undated/today/future remain upcoming for the full day. Overdue open tasks use **UTC today** and strictly earlier deadlines; today is not overdue. Today meeting cards also use UTC. Calendar uses browser-local month/day, includes all dated records and shows first four plus expandable overflow. Global cards are unaffected by list filters.

Automation is opt-in at new-event creation and requires a date. Active templates copy their fields and integer offsets using UTC date arithmetic. Inactive assignees become Unassigned. Deterministic event/template IDs prevent retry duplicates and preserve edited generated tasks. Date-change confirmation recalculates only incomplete generated tasks from their stored offsets. Decline/date clearing, manual tasks and Complete tasks retain deadlines. Template changes/deletion do not rewrite generated tasks.

The main event save uses a transaction/Google script lock and a base/user/latest three-way merge: disjoint edits and concurrent additions survive; same-field conflicts and edits to concurrently deleted rows fail while retaining the form. Other editors use ordinary upserts. Google multi-tab Sheet writes are not fully transactional. Event deletion cascades event-linked rows and unshared speakers while preserving directory entries, meetings, templates, general tasks and external documents.

Excel export requires saved changes and fetches fresh detail. Nine worksheets include IDs, timestamps, provenance, resolved names, typed numeric/date cells and safe hyperlinks. Text is literal, never formula input. Linked documents are not embedded.

## Optional shared Google backend

1. Create a **new** Sheet owned by an enduring organisational account; never reuse the inspected live backend automatically.
2. Extensions → Apps Script; paste `apps-script/Code.gs` and save.
3. Run `setupSpreadsheet()`, authorize owner access, and verify the 14 tabs/headers. Reruns preserve records and add missing columns; initial setup seeds templates once, without committee contacts.
4. Deploy → New deployment → Web app. Execute as owner and deliberately choose access. Copy the `/exec` URL, not `/dev`.
5. Add `APP_DATA_MODE=google` and `GOOGLE_APPS_SCRIPT_URL` in Replit Secrets/config and ensure they are available to the published deployment. Restart/republish.
6. Test health, bootstrap and CRUD against **new disposable owner-approved records**. No Google live deployment, CRUD or Drive upload has been tested here.
7. First notes upload creates/reuses “YEN Event Manager Meeting Notes” in the owner's Drive. Share deliberately with intended users: uploads do not make files public. Replacement trashes the previous upload; deleting a meeting leaves its Drive file. Linked poster/registration/meeting documents retain their own permissions.
8. After backend changes: Deploy → Manage deployments → Edit → New version → Deploy. Saving code alone does not update a deployed API.

**A public proxy is not authentication.** It grants callers the upstream access it has; hiding the URL does not restrict users. Restricted Google sign-in may return HTML rather than JSON because the server cannot complete interactive login. Protected real committee records need a separately designed authenticated architecture. Real workbook data is imported locally; publicly distributing real records requires an explicit visibility decision or a protected shared backend.

## PWA and refresh

Production builds generate a versioned service worker that precaches local shell/assets, falls back to the shell for offline navigation, and explicitly excludes `/api`, POSTs and external URLs. API records/config are never service-worker cached. Demo IndexedDB can remain usable offline; Google loading/saving requires internet and there is no queued sync. Install buttons appear only when the browser offers installation and disappear when installed. iOS Safari: Share → Add to Home Screen → Open as Web App.

Reads have a memory-only 15-second freshness cache, a 5-minute peek limit, 30-entry cap, cloned values and in-flight deduplication. Mutation generations invalidate caches. There is no continuous polling or live collaborative editing.

## GitHub → Replit → public app

This checkout belongs to **sfox2006/YEN-Event-Manager-Replit**, separate from the original reference repository. Review changes, commit and push to this new repository; do not overwrite the reference or force-push.

```sh
git add .
git diff --cached --stat
git diff --cached
git commit -m "Build YEN Event Manager for Replit"
git push origin HEAD:main
```

For a separate new local checkout with no Git metadata, the document's alternative is:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Build YEN Event Manager"
gh auth login
gh repo create yen-event-manager-rebuild --private --source=. --remote=origin --push
```

Alternatively create an empty GitHub repository, `git remote add origin <your repository URL>` and `git push -u origin main`. Private repository visibility and public app visibility are separate. In Codex cloud, supplied Git proxy authentication is used without extracting tokens or interactive login.

1. Open **replit.com/import → GitHub**, connect GitHub and select `sfox2006/YEN-Event-Manager-Replit` → Import. Grant required repository/organisation import access rather than changing private visibility to work around permission errors.
2. Press Run; `.replit` invokes `npm run replit:dev` (frozen install plus development server). No Secrets are required for local storage.
3. In Shell run `npm ci --include=dev`, `npm run typecheck`, `npm test`, `npm run build`. Avoid launching a second server on Run's port.
4. Publishing → Adjust settings → **Autoscale**. Build: `npm ci --include=dev && npm run build`. Run: `npm start`. One port: **3000 → 80** (match a platform `PORT` override if present). Access: **Public**. Choose an available `.replit.app` subdomain and Publish. Account availability/cost requirements are shown by Replit. Static publishing is unsuitable because this app needs Node API/config routes.
5. In a fresh/private browser verify `/#/dashboard`, all routes, `/api/health` (HTTP 200), creation/edit/reload, event deep link, Excel sheets and mobile layout. Replit Preview is not the public deployment.

Updates: commit/push; in a clean Replit checkout pull `git pull --ff-only origin main`, install/build/test, then **Republish**. A GitHub push alone does not update a published app. Resolve diverged/local work consciously; never force overwrite.

## Troubleshooting

- Node/lockfile error: select Node 22.12+ and review manifest/lockfile consistency. Do not delete the lockfile to hide a mismatch.
- Missing Vite/tsc: install with `--include=dev` during build.
- `EADDRINUSE`/502: stop the duplicate server; use `0.0.0.0` and match listener/mapping. Only one port is exposed.
- Missing `dist`: run build before start. Blank assets: use Vite base `/`; HashRouter supports deep-link reload.
- Express route syntax: Express 5 uses `/{*splat}`; unknown API routes return JSON 404.
- Vite host/HMR: permit the actual trusted Replit hostname; do not disable all host checks.
- Google HTML/invalid JSON: check `/exec`, web-app access and deployed version. An HTML sign-in page is not API success.
- Upload 413: encoded 8 MiB needs approximately 10.7 MiB plus metadata; server allows 16 MiB while decoded limit remains 8 MiB.
- Drive Access denied: adjust intended-user Drive permissions; uploading does not share files.
- Stale UI: unregister stale shell service worker/clear shell caches; do not wipe IndexedDB as a first fix.
- Different Preview/public data: expected per-origin local storage. Shared data requires configured Google mode.
- Git/import denied: repair Git Providers/organisation authorization. Do not force-push or automatically make the repo public.

## Validation

See `VALIDATION.md` for the actual current command results and limits. Public Replit publishing and optional Google backend operations are external steps; preparing `.replit` does not mean a site has been deployed.
