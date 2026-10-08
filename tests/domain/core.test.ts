import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import { DemoService } from "../../src/data/demo";
import { blankEvent, seed } from "../../src/data/seed";
import {
  readiness,
  getDetail,
  bucket,
  overdue,
  offsetDate,
  generatedTasks,
  localToday,
  utcToday,
} from "../../src/domain/rules";
import { mergeRow, mergeRows } from "../../src/domain/merge";
import { normalize } from "../../src/data/google";
import { ReadCache } from "../../src/data/readCache";
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("yen-event-manager-demo");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});
describe("business rules", () => {
  it("readiness uses exact saved checks, excludes N/A and irrelevant speakers", () => {
    const t = seed(),
      d = getDetail(t, "event_0");
    expect(readiness(d)).toBe(43);
    d.event.funding_required = "No";
    d.event.room_required = "No";
    d.speakers.forEach((s) => (s.invitation_status = "Declined"));
    expect(readiness(d)).toBe(75);
    d.checklist = [];
    expect(readiness(d)).toBe(100);
  });
  it("unknown resources count as unfulfilled checks, tasks never change readiness", () => {
    const d = getDetail(seed(), "event_7");
    expect(readiness(d)).toBe(0);
    d.event.date = "2026-10-09";
    d.event.lead_organiser_id = "member_0";
    expect(readiness(d)).toBe(50);
    d.tasks.forEach((t) => (t.status = "Complete"));
    expect(readiness(d)).toBe(50);
  });
  it("date buckets prioritize status over date, retain undated and whole-day events", () => {
    const clock = new Date("2026-10-08T12:00:00Z");
    expect(bucket({ status: "Cancelled", date: "2020-01-01" }, clock)).toBe(
      "cancelled",
    );
    expect(bucket({ status: "Completed", date: "2099-01-01" }, clock)).toBe(
      "past",
    );
    expect(bucket({ status: "Idea", date: "" }, clock)).toBe("upcoming");
    expect(bucket({ status: "Planning", date: localToday(clock) }, clock)).toBe(
      "upcoming",
    );
  });
  it("overdue uses UTC and due today is not overdue", () => {
    const task = seed().tasks[0],
      clock = new Date("2026-10-08T00:30:00Z");
    expect(overdue({ ...task, due_date: "2026-10-07" }, clock)).toBe(true);
    expect(overdue({ ...task, due_date: "2026-10-08" }, clock)).toBe(false);
    expect(
      overdue({ ...task, status: "Complete", due_date: "2020-01-01" }, clock),
    ).toBe(false);
    expect(utcToday(clock)).toBe("2026-10-08");
  });
  it("calendar arithmetic handles leap days and DST with copied offsets", () => {
    expect(offsetDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(offsetDate("2026-03-08", 1)).toBe("2026-03-09");
    expect(() => offsetDate("2026-02-30", 0)).toThrow();
  });
  it("generated tasks have deterministic IDs and inactive assignees become unassigned", () => {
    const t = seed(),
      e = { ...t.events[0], date: "2026-11-01" };
    t.committee[0].active = false;
    const tasks = generatedTasks(e, t.task_templates, t.committee);
    expect(tasks).toHaveLength(18);
    expect(
      tasks.find((x) => x.generated_from_template_id === "template_0")
        ?.assignee_member_id,
    ).toBe("");
    expect(
      generatedTasks(e, t.task_templates, t.committee, tasks),
    ).toHaveLength(0);
  });
  it("normalizes external blanks and booleans without inventing zero", () => {
    expect(
      normalize({ active: "FALSE", capacity: "", amount_requested: "20.5" }),
    ).toEqual({ active: false, capacity: undefined, amount_requested: 20.5 });
  });
});
describe("three-way merge", () => {
  it("merges disjoint fields and rejects same-field conflicts", () => {
    expect(mergeRow({ a: 1, b: 1 }, { a: 2, b: 1 }, { a: 1, b: 3 })).toEqual({
      a: 2,
      b: 3,
    });
    expect(() => mergeRow({ a: 1 }, { a: 2 }, { a: 3 })).toThrow(/conflict/);
  });
  it("preserves concurrent inserts and untouched deletions, rejects edited deletions", () => {
    const b = [{ id: "a", name: "old" }];
    expect(
      mergeRows(
        b,
        b,
        [
          { id: "a", name: "old" },
          { id: "new", name: "new" },
        ],
        "id",
      ),
    ).toHaveLength(2);
    expect(mergeRows(b, b, [], "id")).toEqual([]);
    expect(() =>
      mergeRows(b, [{ id: "a", name: "edited" }], [], "id"),
    ).toThrow();
    expect(() =>
      mergeRows(b, [], [{ id: "a", name: "edited" }], "id"),
    ).toThrow();
  });
});
describe("transactional demo", () => {
  it("seeds once, persists name-only creation, and joins directory names", async () => {
    const s = new DemoService(),
      e = { ...blankEvent(), event_name: "Only a name" };
    await s.saveEvent(e);
    expect((await s.getEvent(e.event_id)).event.date).toBe("");
    const b = await s.getBootstrap();
    expect(b.events).toHaveLength(9);
    expect(b.events[0].lead_organiser_name).toBe("Alex Morgan");
    await s.saveCommittee({ ...b.committee[0], name: "Renamed person" });
    expect((await s.getBootstrap()).events[0].lead_organiser_name).toBe(
      "Renamed person",
    );
  });
  it("automation retries do not overwrite edited tasks and template deletion preserves tasks", async () => {
    const s = new DemoService(),
      e = { ...blankEvent(), event_name: "Automated", date: "2026-12-01" };
    await s.createEventWithAutomation(e);
    let b = await s.getBootstrap();
    const task = b.tasks.find((t) => t.event_id === e.event_id)!;
    await s.saveTask({ ...task, task_name: "Edited generated task" });
    await s.createEventWithAutomation(e);
    b = await s.getBootstrap();
    expect(b.tasks.filter((t) => t.event_id === e.event_id)).toHaveLength(18);
    expect(b.tasks.find((t) => t.task_id === task.task_id)?.task_name).toBe(
      "Edited generated task",
    );
    await s.deleteTaskTemplate(task.generated_from_template_id);
    expect(
      (await s.getBootstrap()).tasks.some((t) => t.task_id === task.task_id),
    ).toBe(true);
  });
  it("detail merge preserves independent tasks, timestamps and concurrent edits", async () => {
    const s = new DemoService(),
      base = await s.getEvent("event_0");
    await s.saveEvent({ ...base.event, description: "Concurrent description" });
    const submitted = structuredClone(base);
    submitted.event.event_name = "User name";
    const saved = await s.saveEventDetail({
      ...submitted,
      base_detail: base,
      update_automated_task_deadlines: false,
    });
    expect(saved.event.description).toBe("Concurrent description");
    expect(saved.event.event_name).toBe("User name");
    expect(saved.funding[0].updated_at).toBe(base.funding[0].updated_at);
    expect(saved.tasks).toEqual(base.tasks);
  });
  it("same-field conflict aborts writes and invalid foreign keys are rejected", async () => {
    const s = new DemoService(),
      base = await s.getEvent("event_0");
    await s.saveEvent({ ...base.event, event_name: "Other" });
    await expect(
      s.saveEventDetail({
        ...base,
        event: { ...base.event, event_name: "Mine" },
        base_detail: base,
        update_automated_task_deadlines: false,
      }),
    ).rejects.toThrow(/conflict/);
    expect((await s.getEvent("event_0")).event.event_name).toBe("Other");
    await expect(
      s.saveEvent({
        ...blankEvent(),
        event_name: "Bad",
        lead_organiser_id: "missing",
      }),
    ).rejects.toThrow(/linked/);
  });
  it("recalculation changes only incomplete generated tasks using stored offsets", async () => {
    const s = new DemoService(),
      e = { ...blankEvent(), event_name: "Recalc", date: "2026-12-01" };
    await s.createEventWithAutomation(e);
    let d = await s.getEvent(e.event_id),
      complete = d.tasks[0];
    await s.saveTask({ ...complete, status: "Complete" });
    const manual = {
      ...d.tasks[1],
      task_id: "manual",
      generated_from_template_id: "",
      due_date: "2026-10-01",
    };
    await s.saveTask(manual);
    await s.saveEventDetail({
      ...d,
      event: { ...d.event, date: "2026-12-10" },
      base_detail: d,
      update_automated_task_deadlines: true,
    });
    d = await s.getEvent(e.event_id);
    expect(d.tasks.find((t) => t.task_id === complete.task_id)?.due_date).toBe(
      complete.due_date,
    );
    expect(d.tasks.find((t) => t.task_id === "manual")?.due_date).toBe(
      "2026-10-01",
    );
    expect(
      d.tasks.find(
        (t) =>
          t.task_id === complete.task_id.replace("template_0", "template_2"),
      )?.due_date,
    ).toBe("2026-10-11");
  });
  it("cascade preserves general tasks, directories, meetings and templates", async () => {
    const s = new DemoService(),
      before = await s.getBootstrap();
    await s.deleteEvent("event_0");
    const b = await s.getBootstrap();
    expect(b.tasks.some((t) => t.event_id === "event_0")).toBe(false);
    expect(b.tasks.some((t) => t.event_id === "")).toBe(true);
    expect(b.committee).toEqual(before.committee);
    expect(b.meetings).toEqual(before.meetings);
    expect(b.task_templates).toEqual(before.task_templates);
    await expect(s.getEvent("event_0")).rejects.toThrow(/deleted/);
  });
  it("local meeting files are persisted without durable object URLs", async () => {
    const s = new DemoService(),
      m = (await s.getBootstrap()).meetings[0];
    const saved = await s.saveMeeting(m, {
      name: "notes.pdf",
      type: "application/pdf",
      base64: btoa("%PDF demo"),
    });
    expect(saved.meeting_notes_file_id).toMatch(/^notes_/);
    expect(saved.meeting_notes_file_url).toBe("");
    expect((await s.saveMeeting(saved)).meeting_notes_file_id).toBe(
      saved.meeting_notes_file_id,
    );
  });
});
it("cache coalesces reads and invalidates in-flight results", async () => {
  const cache = new ReadCache();
  let count = 0;
  const load = async () => {
    count++;
    return { a: 1 };
  };
  const [a, b] = await Promise.all([
    cache.read("x", load),
    cache.read("x", load),
  ]);
  a.a = 2;
  expect(b.a).toBe(1);
  expect(count).toBe(1);
  cache.invalidate();
  expect(cache.peek("x")).toBeUndefined();
});

it("speakers need only a name and partner links resolve by ID", async () => {
  const s = new DemoService(),
    base = await s.getEvent("event_7"),
    ts = {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  const detail = await s.saveEventDetail({
    ...base,
    speakers: [
      {
        speaker_id: "new_speaker",
        event_speaker_id: "new_link",
        event_id: "event_7",
        name: "Name only",
        organisation_name: "",
        title: "",
        email: "",
        notes: "",
        invitation_status: "Not contacted",
        ...ts,
      },
    ],
    organisations: [
      {
        event_organisation_id: "new_partner",
        event_id: "event_7",
        organisation_id: "org_1",
        organisation_name: "",
        acronym: "",
        contact_name: "",
        contact_email: "",
        notes: "",
        active: true,
        relationship_type: "Co-host",
        ...ts,
      },
    ],
    base_detail: base,
    update_automated_task_deadlines: false,
  });
  expect(detail.speakers[0].name).toBe("Name only");
  expect(detail.organisations[0].organisation_name).toBe(
    "Future Policy Society",
  );
});
it("event cascade preserves a speaker shared by another event", async () => {
  const s = new DemoService(),
    original = await s.getEvent("event_0"),
    base = await s.getEvent("event_1");
  await s.saveEventDetail({
    ...base,
    speakers: [
      {
        ...original.speakers[0],
        event_speaker_id: "shared_link",
        event_id: "event_1",
      },
    ],
    base_detail: base,
    update_automated_task_deadlines: false,
  });
  await s.deleteEvent("event_0");
  expect((await s.getEvent("event_1")).speakers[0].speaker_id).toBe(
    "speaker_0",
  );
});
it("local/UTC midnight distinction remains explicit", () => {
  const clock = new Date("2026-10-08T00:30:00Z");
  expect(utcToday(clock)).toBe("2026-10-08");
  if (process.env.TZ === "America/Los_Angeles") {
    expect(localToday(clock)).toBe("2026-10-07");
    expect(bucket({ status: "Planning", date: "2026-10-07" }, clock)).toBe(
      "upcoming",
    );
    expect(
      overdue(
        { ...seed().tasks[0], status: "Not started", due_date: "2026-10-07" },
        clock,
      ),
    ).toBe(true);
  } else expect(localToday(clock)).toMatch(/^2026-10-0[78]$/);
});

it("unchanged speaker links retain timestamps regardless of object key order", async () => {
  const s = new DemoService(),
    base = await s.getEvent("event_0"),
    old = base.speakers.map((s) => s.updated_at);
  await new Promise((r) => setTimeout(r, 5));
  const saved = await s.saveEventDetail({
    ...base,
    base_detail: base,
    update_automated_task_deadlines: false,
  });
  expect(saved.speakers.map((s) => s.updated_at)).toEqual(old);
});
