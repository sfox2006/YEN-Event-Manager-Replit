import { adminDecision, requireAdministrator } from "./admin-access.mjs";
/** Replit Agent must supply this adapter from its validated server session. */
export function configureAuthentication(app, adapter) {
  if (typeof adapter?.getVerifiedUser !== "function")
    throw new TypeError("A verified server-session adapter is required");
  for (const key of ["loginPath", "logoutPath"])
    if (
      typeof adapter[key] !== "string" ||
      !/^\/api\/[A-Za-z0-9/_-]+$/.test(adapter[key])
    )
      throw new TypeError(
        "Authentication links must point to same-origin API routes",
      );
  app.locals.authenticationAdapter = adapter;
}
export function authMode() {
  const mode = process.env.APP_AUTH_MODE || "none";
  if (!["none", "replit"].includes(mode))
    throw new Error("APP_AUTH_MODE must be none or replit");
  return mode;
}
export async function verifiedIdentity(app, req) {
  const adapter = app.locals.authenticationAdapter;
  if (!adapter) return null;
  const user = await adapter.getVerifiedUser(req);
  if (!user) return null;
  if (
    typeof user.subject !== "string" ||
    !user.subject ||
    user.subject.trim() !== user.subject
  )
    throw new Error("Invalid verified identity");
  return user;
}
export function requireSignIn(app) {
  return async (req, res, next) => {
    if (!app.locals.authenticationAdapter)
      return res
        .status(503)
        .json({
          ok: false,
          error:
            "Replit Auth must be provisioned and connected before accessing protected data.",
        });
    try {
      const user = await verifiedIdentity(app, req);
      if (!user)
        return res.status(401).json({ ok: false, error: "Sign-in required" });
      res.locals.authenticatedSubject = user.subject;
      next();
    } catch {
      return res
        .status(401)
        .json({ ok: false, error: "Unable to verify sign-in" });
    }
  };
}
export function authenticationRoutes(app) {
  authMode();
  app.get("/api/account", async (req, res) => {
    const adapter = app.locals.authenticationAdapter;
    try {
      const user = await verifiedIdentity(app, req);
      res.json({
        authConfigured: !!adapter,
        authRequired: authMode() === "replit",
        authenticated: !!user,
        administrator:
          !!user &&
          adminDecision(user, process.env.ADMIN_REPLIT_USER_IDS).allowed,
        user: user
          ? {
              subject: user.subject,
              name: typeof user.name === "string" ? user.name : "",
              email: typeof user.email === "string" ? user.email : "",
            }
          : null,
        loginPath: adapter?.loginPath || null,
        logoutPath: adapter?.logoutPath || null,
      });
    } catch {
      res.status(401).json({ error: "Unable to verify sign-in" });
    }
  });
  app.get(
    "/api/admin/access",
    requireAdministrator((req) => verifiedIdentity(app, req)),
    (_req, res) =>
      res.json({ ok: true, subject: res.locals.administratorSubject }),
  );
}
