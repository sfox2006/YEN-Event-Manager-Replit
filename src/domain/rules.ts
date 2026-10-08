import type {
  EventDetail,
  Task,
  Template,
  Member,
  Event,
  Tables,
  EventSummary,
} from "./types";
export const utcToday = (clock: Date | number = new Date()) =>
  new Date(clock).toISOString().slice(0, 10);
export const localToday = (clock: Date | number = new Date()) => {
  const d = new Date(clock);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const formatDate = (date: string) =>
  date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date TBC";
export const bucket = (
  row: { status: string; date: string },
  clock: Date | number = new Date(),
) =>
  row.status === "Cancelled"
    ? "cancelled"
    : row.status === "Completed"
      ? "past"
      : row.date && row.date < localToday(clock)
        ? "past"
        : "upcoming";
export const eventBucket = bucket,
  meetingBucket = bucket;
export const overdue = (t: Task, clock: Date | number = new Date()) =>
  t.status !== "Complete" && !!t.due_date && t.due_date < utcToday(clock);
export function offsetDate(date: string, offset: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(offset))
    throw new Error("A valid event date and integer offset are required");
  const d = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== date)
    throw new Error("Invalid date");
  d.setUTCDate(d.getUTCDate() + offset);
  return utcToday(d);
}
export function readiness(d: EventDetail) {
  const checks = [!!d.event.date, !!d.event.lead_organiser_id];
  if (d.event.funding_required !== "No")
    checks.push(d.funding.some((f) => ["Confirmed", "N/A"].includes(f.status)));
  if (d.event.room_required !== "No")
    checks.push(
      !!d.venue &&
        ["Confirmed", "Not required"].includes(d.venue.booking_status),
    );
  const speakers = d.speakers.filter(
    (s) => !["Declined", "Withdrawn"].includes(s.invitation_status),
  );
  if (speakers.length)
    checks.push(speakers.every((s) => s.invitation_status === "Confirmed"));
  checks.push(
    ...d.checklist
      .filter((c) => c.status !== "Not applicable")
      .map((c) => c.status === "Complete"),
  );
  return Math.round((100 * checks.filter(Boolean).length) / checks.length);
}
export function getDetail(t: Tables, id: string): EventDetail {
  const event = t.events.find((e) => e.event_id === id);
  if (!event) throw new Error("This event does not exist or has been deleted.");
  const linked = <T extends { event_id: string }>(rows: T[]) =>
    rows.filter((r) => r.event_id === id);
  return {
    event,
    speakers: linked(t.event_speakers).map((l) => ({
      ...t.speakers.find((s) => s.speaker_id === l.speaker_id)!,
      ...l,
      speaker_notes:
        t.speakers.find((s) => s.speaker_id === l.speaker_id)?.notes || "",
    })),
    posters: linked(t.posters),
    tasks: linked(t.tasks),
    funding: linked(t.funding),
    venue: linked(t.venues)[0] || null,
    organisations: linked(t.event_organisations).map((l) => ({
      ...t.organisations.find((o) => o.organisation_id === l.organisation_id)!,
      ...l,
    })),
    attendance: linked(t.attendance),
    checklist: linked(t.checklist),
  };
}
export function summary(t: Tables, e: Event): EventSummary {
  const d = getDetail(t, e.event_id),
    sp = d.speakers.filter(
      (s) => !["Declined", "Withdrawn"].includes(s.invitation_status),
    );
  return {
    ...e,
    progress: readiness(d),
    funding_status:
      ["Confirmed", "Pending", "No", "N/A"].find((s) =>
        d.funding.some((f) => f.status === s),
      ) || (e.funding_required === "No" ? "N/A" : "Not started"),
    room_status:
      d.venue?.booking_status ||
      (e.room_required === "No" ? "Not required" : "Not started"),
    speaker_summary: `${sp.filter((s) => s.invitation_status === "Confirmed").length}/${sp.length}`,
    committee_confirmed: d.attendance.filter(
      (a) => a.attendance_status === "Confirmed attending",
    ).length,
    lead_organiser_name:
      t.committee.find((m) => m.member_id === e.lead_organiser_id)?.name ||
      "Unassigned",
    organisation_ids: d.organisations.map((o) => o.organisation_id),
  };
}
export function generatedTasks(
  e: Event,
  templates: Template[],
  members: Member[],
  existing: Task[] = [],
): Task[] {
  return templates
    .filter(
      (t) =>
        t.active &&
        !existing.some(
          (x) => x.task_id === `task_auto_${e.event_id}_${t.template_id}`,
        ),
    )
    .map((t) => ({
      task_id: `task_auto_${e.event_id}_${t.template_id}`,
      event_id: e.event_id,
      task_name: t.task_name,
      description: t.description,
      assignee_member_id: members.some(
        (m) => m.member_id === t.assignee_member_id && m.active,
      )
        ? t.assignee_member_id
        : "",
      due_date: offsetDate(e.date, t.offset_days!),
      priority: t.priority,
      status: "Not started",
      notes: "",
      generated_from_template_id: t.template_id,
      due_date_offset_days: t.offset_days,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
}
export const dateSort = (
  a: { date?: string; due_date?: string; start_time?: string },
  b: typeof a,
) =>
  (a.date || a.due_date || "9999").localeCompare(
    b.date || b.due_date || "9999",
  ) || (a.start_time || "").localeCompare(b.start_time || "");
export function safeUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
