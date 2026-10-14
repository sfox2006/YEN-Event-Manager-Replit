import { it, expect, afterEach, vi } from "vitest";
// @ts-expect-error Server ESM module is exercised directly.
import * as admin from "../../server/admin-access.mjs";
// @ts-expect-error Server ESM module is exercised directly.
import * as authentication from "../../server/authentication.mjs";
const { adminDecision, requireAdministrator } = admin;
const { configureAuthentication, requireSignIn, authenticationRoutes } =
  authentication;
afterEach(() => vi.unstubAllEnvs());
function response() {
  return {
    statusCode: 200,
    locals: {} as Record<string, unknown>,
    body: null as any,
    status(n: number) {
      this.statusCode = n;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}
it("administrator access denies anonymous, missing configuration and non-owner identities", () => {
  expect(adminDecision(null, "owner").status).toBe(401);
  expect(adminDecision({ subject: "owner" }, "").status).toBe(503);
  expect(
    adminDecision(
      { subject: "other", role: "admin", email: "owner@example.com" },
      "owner",
    ).status,
  ).toBe(403);
  expect(adminDecision({ subject: "owner" }, "owner").allowed).toBe(true);
  expect(adminDecision({ subject: "OWNER" }, "owner").allowed).toBe(false);
  expect(adminDecision({ subject: " owner" }, "owner").allowed).toBe(false);
});
it("administrator middleware ignores claimed browser identities and fails closed on verification errors", async () => {
  const next = vi.fn(),
    res = response();
  await requireAdministrator(
    async () => ({ subject: "other" }),
    () => "owner",
  )({ headers: { "x-user-id": "owner" }, body: { role: "admin" } }, res, next);
  expect(res.statusCode).toBe(403);
  expect(next).not.toHaveBeenCalled();
  const failure = response();
  await requireAdministrator(
    async () => {
      throw new Error("secret detail");
    },
    () => "owner",
  )({}, failure, next);
  expect(failure.statusCode).toBe(401);
  expect(JSON.stringify(failure.body)).not.toContain("secret detail");
});
it("administrator allowlist revocation applies to the next request", async () => {
  let ids = "owner";
  const guard = requireAdministrator(
      async () => ({ subject: "owner" }),
      () => ids,
    ),
    next = vi.fn();
  await guard({}, response(), next);
  expect(next).toHaveBeenCalledOnce();
  ids = "";
  const res = response();
  await guard({}, res, next);
  expect(res.statusCode).toBe(503);
  expect(next).toHaveBeenCalledOnce();
});
it("provider installation requires a server-session adapter and same-origin authentication routes", () => {
  const app = { locals: {} };
  expect(() => configureAuthentication(app, {})).toThrow();
  expect(() =>
    configureAuthentication(app, {
      getVerifiedUser: async () => null,
      loginPath: "https://other.example/login",
      logoutPath: "/api/logout",
    }),
  ).toThrow();
  expect(() =>
    configureAuthentication(app, {
      getVerifiedUser: async () => null,
      loginPath: "/api/login",
      logoutPath: "/api/logout",
    }),
  ).not.toThrow();
});
it("protected data denies missing adapter, anonymous, malformed and failed sessions", async () => {
  const app: { locals: any } = { locals: {} },
    next = vi.fn();
  let res = response();
  await requireSignIn(app)({}, res, next);
  expect(res.statusCode).toBe(503);
  for (const getVerifiedUser of [
    async () => null,
    async () => ({ subject: " owner" }),
    async () => {
      throw new Error("private token");
    },
  ]) {
    app.locals.authenticationAdapter = { getVerifiedUser };
    res = response();
    await requireSignIn(app)({ headers: { "x-user-id": "owner" } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("private token");
  }
  expect(next).not.toHaveBeenCalled();
});
it("validated sessions authorize requests and expose only the verified account", async () => {
  vi.stubEnv("ADMIN_REPLIT_USER_IDS", "owner");
  const routes = new Map<string, Function[]>(),
    app = {
      locals: {} as any,
      get: (path: string, ...handlers: Function[]) =>
        routes.set(path, handlers),
    };
  configureAuthentication(app, {
    getVerifiedUser: async () => ({
      subject: "owner",
      name: "Verified Name",
      email: "verified@example.com",
      token: "hidden",
    }),
    loginPath: "/api/login",
    logoutPath: "/api/logout",
  });
  authenticationRoutes(app);
  const res = response();
  await routes.get("/api/account")![0](
    { headers: { "x-user-id": "imposter" } },
    res,
  );
  expect(res.body.authenticated).toBe(true);
  expect(res.body.administrator).toBe(true);
  expect(res.body.user.subject).toBe("owner");
  expect(JSON.stringify(res.body)).not.toContain("hidden");
  const next = vi.fn();
  await requireSignIn(app)({}, response(), next);
  expect(next).toHaveBeenCalledOnce();
});
