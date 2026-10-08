import { openDB } from "idb";
import type {
  Tables,
  Event,
  EventDetail,
  DetailPayload,
  Member,
  Organisation,
  Meeting,
  Task,
  Template,
  NotesFile,
  Row,
} from "../domain/types";
import type { DataService } from "./service";
import { seed, stamp, id } from "./seed";
import {
  summary,
  getDetail,
  generatedTasks,
  offsetDate,
  safeUrl,
} from "../domain/rules";
import { mergeRow, mergeRows, same } from "../domain/merge";
const dbPromise = () =>
  openDB("yen-event-manager-demo", 1, {
    upgrade(db) {
      db.createObjectStore("state");
      db.createObjectStore("files");
    },
  });
const equal = same;
function stamped<T extends Row>(row: T, old?: T): T {
  if (old) {
    const a = {
      ...row,
      created_at: old.created_at,
      updated_at: old.updated_at,
    };
    return equal(a, old) ? old : { ...a, updated_at: new Date().toISOString() };
  }
  return { ...row, ...stamp() };
}
function validate(row: object, t: Tables) {
  const r = row as Record<string, unknown>;
  for (const [k, v] of Object.entries(r)) {
    if (
      [
        "event_name",
        "task_name",
        "meeting_name",
        "organisation_name",
        "name",
      ].includes(k) &&
      !(
        k === "organisation_name" &&
        (!("organisation_id" in r) || "event_organisation_id" in r)
      ) &&
      !String(v || "").trim()
    )
      throw new Error("A name is required.");
    if (
      [
        "registration_numbers",
        "registration_capacity",
        "capacity",
        "amount_requested",
        "amount_confirmed",
        "offset_days",
        "due_date_offset_days",
      ].includes(k) &&
      v !== undefined &&
      v !== ""
    ) {
      if (
        typeof v !== "number" ||
        !Number.isFinite(v) ||
        (!["amount_requested", "amount_confirmed"].includes(k) &&
          !Number.isInteger(v)) ||
        (!k.includes("offset") && v < 0) ||
        (k.includes("offset") && Math.abs(v) > 3650)
      )
        throw new Error("Invalid amount, count, capacity or timing offset.");
    }
    if (
      (k.endsWith("_link") || k === "drive_url") &&
      typeof v === "string" &&
      !safeUrl(v)
    )
      throw new Error("Links must use http:// or https://.");
    if ((k === "date" || k === "due_date") && v) offsetDate(String(v), 0);
    if (
      ["start_time", "end_time"].includes(k) &&
      v &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))
    )
      throw new Error("Invalid time.");
  }
  for (const [k, list, pk] of [
    ["event_id", t.events, "event_id"],
    ["member_id", t.committee, "member_id"],
    ["lead_organiser_id", t.committee, "member_id"],
    ["assignee_member_id", t.committee, "member_id"],
    ["organiser_member_id", t.committee, "member_id"],
    ["organisation_id", t.organisations, "organisation_id"],
  ] as const) {
    if (
      r[k] &&
      !(
        (k === "event_id" && "event_name" in r) ||
        (k === "member_id" && "name" in r) ||
        (k === "organisation_id" &&
          "organisation_name" in r &&
          !("event_organisation_id" in r))
      ) &&
      !list.some((x) => (x as unknown as Record<string, unknown>)[pk] === r[k])
    )
      throw new Error("Invalid linked record: " + k);
  }
}
export function validateNotes(file: NotesFile) {
  const mime: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (mime[ext] !== file.type)
    throw new Error("Choose a PDF, DOC or DOCX with a matching file type.");
  const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw new Error("Notes files must be nonempty and at most 8 MiB.");
  return new Blob([bytes], { type: file.type });
}
export class DemoService implements DataService {
  mode = "demo" as const;
  private async run<T>(
    fn: (t: Tables, files: Map<string, Blob>) => T,
    write = false,
  ): Promise<T> {
    const db = await dbPromise(),
      tx = db.transaction(["state", "files"], "readwrite"),
      store = tx.objectStore("state");
    let t = (await store.get("tables")) as Tables | undefined;
    const marker = await store.get("seed_version");
    if (!t || marker !== 1) {
      t = seed();
      await store.put(t, "tables");
      await store.put(1, "seed_version");
    }
    const files = new Map<string, Blob>();
    let result: T;
    try {
      result = fn(t, files);
      if (write) await store.put(t, "tables");
      for (const [key, value] of files)
        await tx.objectStore("files").put(value, key);
      await tx.done;
    } catch (e) {
      tx.abort();
      await tx.done.catch(() => {});
      db.close();
      throw e;
    }
    db.close();
    return structuredClone(result);
  }
  getBootstrap() {
    return this.run((t) => ({
      events: t.events.map((e) => summary(t, e)),
      committee: t.committee,
      organisations: t.organisations,
      meetings: t.meetings,
      tasks: t.tasks,
      task_templates: t.task_templates,
    }));
  }
  getEvent(eventId: string) {
    return this.run((t) => getDetail(t, eventId));
  }
  private upsert<T extends Row>(list: T[], row: T, key: keyof T, t: Tables) {
    validate(row, t);
    const old = list.find((x) => x[key] === row[key]),
      saved = stamped(row, old);
    if (old) list[list.indexOf(old)] = saved;
    else list.push(saved);
    return saved;
  }
  saveEvent(event: Event) {
    return this.run((t) => this.upsert(t.events, event, "event_id", t), true);
  }
  createEventWithAutomation(event: Event) {
    return this.run((t) => {
      offsetDate(event.date, 0);
      const existing = t.events.find((e) => e.event_id === event.event_id);
      const e = existing || this.upsert(t.events, event, "event_id", t);
      t.tasks.push(
        ...generatedTasks(e, t.task_templates, t.committee, t.tasks),
      );
      return e;
    }, true);
  }
  saveCommittee(member: Member) {
    return this.run(
      (t) => this.upsert(t.committee, member, "member_id", t),
      true,
    );
  }
  saveOrganisation(org: Organisation) {
    return this.run(
      (t) => this.upsert(t.organisations, org, "organisation_id", t),
      true,
    );
  }
  saveTask(task: Task) {
    return this.run((t) => this.upsert(t.tasks, task, "task_id", t), true);
  }
  saveTaskTemplate(template: Template) {
    return this.run((t) => {
      if (template.offset_days === undefined)
        throw new Error("A timing offset is required.");
      return this.upsert(t.task_templates, template, "template_id", t);
    }, true);
  }
  saveMeeting(meeting: Meeting, file?: NotesFile) {
    return this.run((t, files) => {
      const old = t.meetings.find((m) => m.meeting_id === meeting.meeting_id);
      let m = { ...meeting };
      if (file) {
        const blob = validateNotes(file),
          key = id("notes");
        files.set(key, blob);
        m = {
          ...m,
          meeting_notes_file_id: key,
          meeting_notes_file_name: file.name,
          meeting_notes_file_url: "",
        };
      } else if (old)
        m = {
          ...m,
          meeting_notes_file_id: old.meeting_notes_file_id,
          meeting_notes_file_name: old.meeting_notes_file_name,
          meeting_notes_file_url: old.meeting_notes_file_url,
        };
      return this.upsert(t.meetings, m, "meeting_id", t);
    }, true);
  }
  async openNotes(key: string) {
    const db = await dbPromise(),
      blob = await db.get("files", key);
    db.close();
    if (!blob)
      throw new Error("This local demo upload is unavailable in this browser.");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  deleteTask(key: string) {
    return this.run((t) => {
      t.tasks = t.tasks.filter((x) => x.task_id !== key);
    }, true);
  }
  deleteMeeting(key: string) {
    return this.run((t) => {
      t.meetings = t.meetings.filter((x) => x.meeting_id !== key);
    }, true);
  }
  deleteTaskTemplate(key: string) {
    return this.run((t) => {
      t.task_templates = t.task_templates.filter((x) => x.template_id !== key);
    }, true);
  }
  deleteEvent(key: string) {
    return this.run((t) => {
      const sp = t.event_speakers
        .filter((x) => x.event_id === key)
        .map((x) => x.speaker_id);
      t.events = t.events.filter((e) => e.event_id !== key);
      for (const table of [
        "event_speakers",
        "posters",
        "tasks",
        "attendance",
        "event_organisations",
        "funding",
        "venues",
        "checklist",
      ] as const)
        (t[table] as { event_id: string }[]) = (
          t[table] as { event_id: string }[]
        ).filter((x) => x.event_id !== key);
      t.speakers = t.speakers.filter(
        (s) =>
          !sp.includes(s.speaker_id) ||
          t.event_speakers.some((l) => l.speaker_id === s.speaker_id),
      );
    }, true);
  }
  saveEventDetail(p: DetailPayload) {
    return this.run((t) => {
      const latest = getDetail(t, p.event.event_id),
        base = p.base_detail;
      const event = mergeRow(base.event, p.event, latest.event);
      this.upsert(t.events, event, "event_id", t);
      const specs = [
        ["funding", "funding", "funding_id"],
        ["posters", "posters", "poster_id"],
        ["attendance", "attendance", "attendance_id"],
        ["checklist", "checklist", "checklist_id"],
        ["organisations", "event_organisations", "event_organisation_id"],
        ["speakers", "event_speakers", "event_speaker_id"],
      ] as const;
      for (const [field, table, key] of specs) {
        let submitted = p[field] as unknown as Record<string, unknown>[];
        if (field === "speakers")
          submitted = submitted.filter((s) => String(s.name || "").trim());
        if (field === "posters")
          submitted = submitted.filter((s) => s.title || s.drive_url);
        if (field === "organisations")
          submitted = submitted.filter((s) => s.organisation_id);
        const rows = mergeRows(
          base[field] as unknown as Record<string, unknown>[],
          submitted,
          latest[field] as unknown as Record<string, unknown>[],
          key,
        );
        const old = t[table] as unknown as Record<string, unknown>[];
        const replacements = rows.map((r) => {
          validate(r, t);
          if (field === "speakers") {
            const master = {
              speaker_id: r.speaker_id,
              name: r.name,
              organisation_name: r.organisation_name,
              title: r.title,
              email: r.email,
              notes: r.speaker_notes || "",
              created_at: r.created_at,
              updated_at: r.updated_at,
            };
            this.upsert(
              t.speakers,
              master as unknown as Tables["speakers"][0],
              "speaker_id",
              t,
            );
            const {
              name,
              organisation_name,
              title,
              email,
              speaker_notes,
              ...link
            } = r;
            void name;
            void organisation_name;
            void title;
            void email;
            void speaker_notes;
            r = link;
          }
          if (field === "organisations") {
            const {
              event_organisation_id,
              event_id,
              organisation_id,
              relationship_type,
              created_at,
              updated_at,
            } = r;
            r = {
              event_organisation_id,
              event_id,
              organisation_id,
              relationship_type,
              created_at,
              updated_at,
            };
          }
          return stamped(
            r as unknown as Row,
            old.find((x) => x[key] === r[key]) as unknown as Row,
          );
        });
        (t[table] as unknown as Row[]) = old.filter(
          (x) => x.event_id !== event.event_id,
        ) as unknown as Row[];
        (t[table] as unknown as Row[]).push(...replacements);
      }
      const mergedVenue = mergeRows(
        base.venue ? [base.venue] : [],
        p.venue ? [p.venue] : [],
        latest.venue ? [latest.venue] : [],
        "venue_id",
      );
      t.venues = t.venues.filter((x) => x.event_id !== event.event_id);
      for (const v of mergedVenue) {
        validate(v, t);
        t.venues.push(stamped(v, latest.venue || undefined));
      }
      if (
        p.update_automated_task_deadlines &&
        event.date &&
        event.date !== latest.event.date
      )
        t.tasks = t.tasks.map((task) =>
          task.event_id === event.event_id &&
          task.status !== "Complete" &&
          task.generated_from_template_id
            ? stamped(
                {
                  ...task,
                  due_date: offsetDate(
                    event.date,
                    task.due_date_offset_days || 0,
                  ),
                },
                task,
              )
            : task,
        );
      return getDetail(t, event.event_id);
    }, true);
  }
}
