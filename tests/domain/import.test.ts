import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  importRows,
  normalizeWorkbookCell,
} from "../../src/data/workbookImport";
import { seed } from "../../src/data/seed";
import { tableSchema } from "../../src/data/schema";
import { fixtureSeed } from "../fixtures/seed";
import { removeSynthetic } from "../../src/data/migration";
import { DemoService } from "../../src/data/demo";
function sheets() {
  const t = fixtureSeed();
  return Object.fromEntries(
    Object.entries(tableSchema).map(([key, def]) => [
      def.name,
      [
        Array.from(def.headers),
        ...(
          t[key as keyof typeof t] as unknown as Record<string, unknown>[]
        ).map((row) => def.headers.map((h) => row[h] ?? null)),
      ],
    ]),
  );
}
it("production starts empty without simulated people, events or templates", () => {
  expect(Object.values(seed()).every((r) => r.length === 0)).toBe(true);
});
it("full workbook import preserves IDs, joins, dates and optional blank numbers", () => {
  const result = importRows(sheets());
  expect(result.tables.events[0].event_id).toBe("event_0");
  expect(result.tables.committee).toHaveLength(7);
  expect(result.tables.funding[0].amount_confirmed).toBeUndefined();
  expect(
    normalizeWorkbookCell("start_time", new Date("1899-12-30T19:00:00Z")),
  ).toBe("19:00");
  expect(normalizeWorkbookCell("date", new Date("2026-09-20T00:00:00Z"))).toBe(
    "2026-09-20",
  );
});
it("known shifted legacy meeting columns are repaired and missing timestamps reported", () => {
  const s = sheets(),
    def = tableSchema.meetings.headers,
    row = s.Meetings[1];
  row[def.indexOf("status")] = null;
  row[def.indexOf("agenda")] = "Planned";
  row[def.indexOf("created_at")] = "Meeting purpose";
  row[def.indexOf("updated_at")] = null;
  const result = importRows(s, new Date("2026-10-08T12:00:00Z"));
  expect(result.tables.meetings[0].status).toBe("Planned");
  expect(result.tables.meetings[0].agenda).toBe("Meeting purpose");
  expect(result.tables.meetings[0].created_at).toBe("2026-10-08T12:00:00.000Z");
  expect(result.warnings).toHaveLength(3);
});
it("malformed and dangling-reference workbooks fail before persistence", () => {
  const s = sheets();
  delete s.Funding;
  expect(() => importRows(s)).toThrow(/Missing worksheet/);
  const bad = sheets();
  bad.Events[1][8] = "missing";
  expect(() => importRows(bad)).toThrow(/unresolved/);
});
it("migration removes seeded rows while preserving new tasks and records", () => {
  const t = fixtureSeed();
  t.events.push({
    ...t.events[0],
    event_id: "custom_event",
    lead_organiser_id: "member_0",
  });
  t.tasks.push({ ...t.tasks[0], task_id: "custom_task", event_id: "event_0" });
  const clean = removeSynthetic(t);
  expect(clean.events).toHaveLength(1);
  expect(clean.events[0].lead_organiser_id).toBe("");
  expect(clean.tasks[0].task_id).toBe("custom_task");
  expect(clean.tasks[0].event_id).toBe("");
  expect(clean.committee).toHaveLength(0);
});
it("replacement persists imported records and never reseeds synthetic data", async () => {
  const service = new DemoService();
  await service.replaceData(importRows(sheets()).tables);
  const b = await service.getBootstrap();
  expect(b.events).toHaveLength(8);
  await service.saveEvent({ ...b.events[0], event_name: "Imported edit" });
  expect((await new DemoService().getBootstrap()).events[0].event_name).toBe(
    "Imported edit",
  );
});
