import "dotenv/config";
import express from "express";
export const port = Number(process.env.PORT || 3000);
export const reads = ["health", "bootstrap", "event"];
export const writes = [
  "saveEvent",
  "createEventWithAutomation",
  "saveEventDetail",
  "deleteEvent",
  "saveCommittee",
  "saveOrganisation",
  "saveMeeting",
  "deleteMeeting",
  "saveTask",
  "deleteTask",
  "saveTaskTemplate",
  "deleteTaskTemplate",
];
export function api(app) {
  const mode = process.env.APP_DATA_MODE || "demo";
  if (!["demo", "google"].includes(mode))
    throw new Error("APP_DATA_MODE must be demo or google");
  let endpoint;
  if (mode === "google") {
    try {
      endpoint = new URL(process.env.GOOGLE_APPS_SCRIPT_URL);
      if (
        endpoint.protocol !== "https:" ||
        endpoint.hostname !== "script.google.com" ||
        !/^\/macros\/s\/[^/]+\/exec$/.test(endpoint.pathname) ||
        endpoint.search ||
        endpoint.hash
      )
        throw 0;
    } catch {
      throw new Error(
        "Google mode requires a valid HTTPS script.google.com web-app /exec URL",
      );
    }
  }
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "16mb" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/config", (_req, res) => res.json({ dataMode: mode }));
  app.all("/api/data", async (req, res) => {
    const action = req.query.action;
    if (
      typeof action !== "string" ||
      !(
        (req.method === "GET" && reads.includes(action)) ||
        (req.method === "POST" && writes.includes(action))
      )
    )
      return res
        .status(400)
        .json({ ok: false, error: "Unsupported action or method" });
    if (mode !== "google")
      return res
        .status(400)
        .json({ ok: false, error: "Google backend is not enabled" });
    try {
      const url = new URL(endpoint);
      url.searchParams.set("action", action);
      if (action === "event")
        url.searchParams.set("event_id", String(req.query.event_id || ""));
      const response = await fetch(url, {
        method: req.method,
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        ...(req.method === "POST"
          ? {
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ ...req.body, action }),
            }
          : {}),
      });
      const data = await response.json();
      if (
        typeof data.ok !== "boolean" ||
        (data.ok && !("data" in data)) ||
        (!data.ok && typeof data.error !== "string")
      )
        throw 0;
      res.status(data.ok ? 200 : 400).json(data);
    } catch {
      res
        .status(502)
        .json({
          ok: false,
          error:
            "Google backend did not return valid JSON. Check its deployed /exec URL, access permissions, and availability.",
        });
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ ok: false, error: "API route not found" }),
  );
  app.use((err, _req, res, next) => {
    if (err)
      return res
        .status(err.status || 400)
        .json({
          ok: false,
          error:
            err.type === "entity.too.large"
              ? "Request exceeds 16 MiB"
              : "Invalid request body",
        });
    next();
  });
}
