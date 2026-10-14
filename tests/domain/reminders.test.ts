import "fake-indexeddb/auto";
import { it, expect, beforeEach } from "vitest";
import { taskEmail, makeAnnouncement } from "../../src/domain/taskReminder";
import { fixtureSeed } from "../fixtures/seed";
import { DemoService } from "../../src/data/demo";
beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase("yen-event-manager-demo");
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
});

it("email drafts use current assignee address and encode task, due date and multiline notes", () => {
  const t = fixtureSeed(),
    task = {
      ...t.tasks[0],
      task_name: "Review & approve? #1",
      due_date: "2026-10-20",
      notes: "First line\nBudget: $100 & equipment",
    },
    member = { ...t.committee[0], email: "updated+tasks@example.com" };
  const uri = taskEmail(task, member)!;
  expect(uri).toMatch(/^mailto:updated%2Btasks@example.com\?/);
  const params = new URLSearchParams(uri.slice(uri.indexOf("?") + 1));
  expect(params.get("subject")).toBe(
    "Reminder: Review & approve? #1 — due 20 Oct 2026",
  );
  expect(params.get("body")).toContain("First line\nBudget: $100 & equipment");
  expect(params.get("body")).toContain("Hi Alex Morgan");
  expect([...params.keys()]).toEqual(["subject", "body"]);
});
it("missing assignee/email and header-injection addresses do not produce email links", () => {
  const t = fixtureSeed();
  expect(taskEmail(t.tasks[0])).toBeNull();
  expect(taskEmail(t.tasks[0], { ...t.committee[0], email: "" })).toBeNull();
  expect(
    taskEmail(t.tasks[0], {
      ...t.committee[0],
      email: "person@example.com\r\nbcc:other@example.com",
    }),
  ).toBeNull();
});
it("undated reminders explain blank fields and capture saved task details", () => {
  const t = fixtureSeed(),
    a = makeAnnouncement(
      { ...t.tasks[0], due_date: "", notes: "" },
      t.committee[0],
      "announcement_test",
      new Date("2026-10-14T12:00Z"),
    );
  expect(a.message).toContain("No due date set");
  expect(a.message).toContain("No notes provided.");
  expect(a.created_at).toBe("2026-10-14T12:00:00.000Z");
  expect(a.read_at).toBe("");
});
it("reminders persist independently of tasks, are idempotent and can be marked read/unread", async () => {
  const service = new DemoService();
  await service.replaceData(fixtureSeed());
  const a = await service.sendTaskReminder("task_0", "announcement_test");
  await service.sendTaskReminder("task_0", "announcement_test");
  expect(await new DemoService().getAnnouncements()).toHaveLength(1);
  expect(a.member_id).toBe("member_0");
  await service.markAnnouncementRead(a.announcement_id, true);
  expect((await service.getAnnouncements())[0].read_at).not.toBe("");
  await service.markAnnouncementRead(a.announcement_id, false);
  expect((await service.getAnnouncements())[0].read_at).toBe("");
  await service.deleteTask("task_0");
  expect((await service.getAnnouncements())[0].task_name).toBe(
    "Review event plan",
  );
});
it("unassigned and deleted tasks cannot create reminders", async () => {
  const service = new DemoService(),
    t = fixtureSeed();
  t.tasks[0].assignee_member_id = "";
  await service.replaceData(t);
  await expect(
    service.sendTaskReminder("task_0", "announcement_unassigned"),
  ).rejects.toThrow(/Assign/);
  await expect(
    service.sendTaskReminder("deleted", "announcement_deleted"),
  ).rejects.toThrow(/deleted/);
  expect(await service.getAnnouncements()).toEqual([]);
});
