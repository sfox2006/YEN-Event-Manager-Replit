import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { it, expect } from "vitest";
import { seed } from "../../src/data/seed";
function backend() {
  let tables = seed();
  const lock = {
    waitLock() {},
    releaseLock() {},
    hasLock() {
      return true;
    },
  };
  const context = createContext({
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({
        setMimeType: () => JSON.parse(text),
      }),
    },
    LockService: { getScriptLock: () => lock },
    load: () => structuredClone(tables),
    persist: (t: typeof tables) => {
      tables = structuredClone(t);
    },
  });
  runInContext(readFileSync("apps-script/Code.gs", "utf8"), context);
  runInContext("readTables=()=>load();writeTables=t=>persist(t);", context);
  const post = (action: string, payload: object) => {
    context.request = {
      parameter: {},
      postData: { contents: JSON.stringify({ action, ...payload }) },
    };
    return runInContext("doPost(request)", context);
  };
  const get = (action: string, event_id?: string) => {
    context.request = { parameter: { action, event_id } };
    return runInContext("doGet(request)", context);
  };
  return { post, get, context };
}
it("Apps Script schema provides all 14 tables and the shared read contract", () => {
  const b = backend();
  expect(runInContext("Object.keys(SCHEMA).length", b.context)).toBe(14);
  const boot = b.get("bootstrap");
  expect(boot.ok).toBe(true);
  expect(boot.data.events[0].progress).toBe(43);
  expect(b.get("event", "event_0").data.speakers).toHaveLength(3);
  expect(b.post("unknown", {}).ok).toBe(false);
});
it("Apps Script mutation dispatch preserves automation idempotency and cascade boundaries", () => {
  const b = backend(),
    event = {
      ...b.get("event", "event_0").data.event,
      event_id: "google_test",
      event_name: "Disposable mocked event",
    };
  expect(b.post("createEventWithAutomation", { event }).ok).toBe(true);
  expect(b.post("createEventWithAutomation", { event }).ok).toBe(true);
  expect(b.get("event", "google_test").data.tasks).toHaveLength(18);
  expect(b.post("deleteEvent", { event_id: "google_test" }).ok).toBe(true);
  expect(b.get("bootstrap").data.committee).toHaveLength(7);
  expect(b.get("event", "google_test").ok).toBe(false);
});
it("Apps Script merges disjoint edits and rejects same-field conflicts", () => {
  const b = backend(),
    base = b.get("event", "event_0").data;
  b.post("saveEvent", {
    event: { ...base.event, description: "Other editor" },
  });
  const p = {
    ...base,
    event: { ...base.event, event_name: "My edit" },
    base_detail: base,
    update_automated_task_deadlines: false,
  };
  const result = b.post("saveEventDetail", p);
  expect(result.ok).toBe(true);
  expect(result.data.event.description).toBe("Other editor");
  expect(result.data.speakers[0].updated_at).toBe(base.speakers[0].updated_at);
  expect(
    b.post("saveEventDetail", {
      ...p,
      event: { ...base.event, description: "Conflict" },
    }).ok,
  ).toBe(false);
});
