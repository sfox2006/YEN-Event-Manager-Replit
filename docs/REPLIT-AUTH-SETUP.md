# Activate Replit sign-in for YEN Event Manager

The inspected reference `sfox2006/Internship-hub-replit` (commit `6168f4f`) does not have real sign-in in its GitHub source. Its Enter demo flag is browser-local, and its tested server administrator guard is waiting for Replit Auth activation. YEN adopts that verified-identity/exact-ID authorization contract. It does not copy the demo flag as authentication.

Current YEN state: `/api/account` and Account show whether a real adapter exists; no fake login or role is assigned. `server/admin-access.mjs` denies access without an exact configured verified ID. `server/authentication.mjs` can register a verified-session adapter and guards the Google data proxy when an adapter is present or `APP_AUTH_MODE=replit`. Setting that mode without a provisioned adapter denies data access with HTTP 503. The default `none` keeps existing browser-local workflows usable; it does not authenticate users or secure browser storage. Anonymous protected requests must receive 401 after provisioning. Authenticated non-admin administrator requests must receive 403.

Replit Auth provisioning must be performed by the Agent inside the actual Replit project. The reference cites Replit's Agent-only integration at https://docs.replit.com/replit-workspace/replit-auth. This cloud checkout has no Replit project session or owner identity; no real callback, user signup or logout has been verified.

## Paste into Replit Agent

```text
Enable real Replit Auth in my existing YEN Event Manager using Replit's supported Agent integration and durable database-backed sessions. Preserve imported records, task reminders, email-draft actions, styles, the single Express server and current publishing domain. Pull the latest GitHub main without overwriting local Replit changes.

Use the exact-ID administrator model prepared in server/admin-access.mjs and server/authentication.mjs. Do not use the Internship Hub's Enter demo flag as authentication. Do not trust browser roles, local profile fields, request user-ID headers, or an unverified email match. Do not promote the first signup to administrator.

Install Replit's generated login/callback/logout and session middleware BEFORE api(app) in both server/index.mjs and server/dev.mjs. Then call configureAuthentication(app, {getVerifiedUser, loginPath, logoutPath}). getVerifiedUser(req) must return null for anonymous sessions or {subject: stableVerifiedReplitUserId, name, email} obtained exclusively from the provider-validated server session. Authentication links must be same-origin /api paths, not arbitrary supplied URLs. Account fetches /api/account and only shows sign-in/sign-out controls when that adapter is connected. Real logout must invalidate the server session, not just clear a browser flag.

Have me sign in and show my verified stable user ID on Account. Confirm which verified account is mine, then set ADMIN_REPLIT_USER_IDS to its exact ID in server-side configuration. Do not infer ownership from my GitHub username or copy the Internship Hub's owner ID. Keep ordinary signups unapproved for committee access until the owner approves them. Add server-side membership authorization to every shared data action; authentication alone is insufficient for private committee records. Use requireAdministrator for owner-only import, member approval, access changes and other administration.

Set APP_AUTH_MODE=replit only after provisioning the supported adapter. This enables the existing fail-closed sign-in guard on /api/data. Keep /api/health public. Gate application pages using verified server account/membership state, including deep links. Neither hiding navigation nor browser IndexedDB is an access-control boundary. Never call an authenticated request public merely because it came from the frontend.

For shared committee records/reminders, implement persistent authenticated storage with server-enforced membership and recipient authorization, and an explicit owner-approved import. Preserve original stable record IDs. Do not overwrite or silently upload browser-local workbook records, backups, notes or files. Explain the migration and complete an approved backup/import. Map verified accounts to committee member IDs via an owner-approved binding; do not let users claim another member by changing their email or member_id. Announcements must be filtered and read status enforced on the server for the verified recipient (and authorized administrator), not just through the existing all-member dropdown. Email reminder addresses should come from authorized account/member records. Do not claim cross-device reminder delivery if data still lives only in IndexedDB.

Use secure HttpOnly cookies, CSRF protection for writes/logout, validated callback/return URLs and the supported durable session store suitable for Autoscale. Validate Preview and the published domain callbacks. Do not commit passwords, session secrets or provider credentials, and do not request them in chat.

Run typecheck, unit tests, build and relevant browser checks. Verify real provider login/logout; anonymous shared API requests 401; authenticated unapproved users 403; approved member access; exact configured owner access; spoofed roles/headers denied; owner removal revokes admin access; expired session/logout denies further access; one member cannot read or mark another member's reminders; storage survives restart and different browsers see authorized shared records. Mocked guards are not evidence of a live authenticated deployment.

Report configured owner, migration results and actual authentication tests before republishing. If provisioning, database credentials or verified owner binding is missing, identify the exact remaining requirement rather than fabricating a working login.
```
