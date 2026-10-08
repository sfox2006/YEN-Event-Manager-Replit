import type { DataService } from "./service";
import type {
  Event,
  DetailPayload,
  Member,
  Organisation,
  Meeting,
  Task,
  Template,
  NotesFile,
} from "../domain/types";
const numeric = new Set([
  "registration_numbers",
  "registration_capacity",
  "capacity",
  "amount_requested",
  "amount_confirmed",
  "offset_days",
  "due_date_offset_days",
]);
export function normalize(value: unknown): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "active"
          ? v === true || String(v).toLowerCase() === "true"
          : numeric.has(k)
            ? v === "" || v === null
              ? undefined
              : Number(v)
            : normalize(v),
      ]),
    );
  return value;
}
export class GoogleService implements DataService {
  mode = "google" as const;
  private async call(action: string, payload?: object, query = "") {
    const res = await fetch(`/api/data?action=${action}${query}`, {
      method: payload ? "POST" : "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(22000),
      ...(payload
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        : {}),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Unable to save shared data");
    return normalize(json.data);
  }
  getBootstrap() {
    return this.call("bootstrap");
  }
  getEvent(id: string) {
    return this.call("event", undefined, "&event_id=" + encodeURIComponent(id));
  }
  saveEvent(event: Event) {
    return this.call("saveEvent", { event });
  }
  createEventWithAutomation(event: Event) {
    return this.call("createEventWithAutomation", { event });
  }
  saveEventDetail(payload: DetailPayload) {
    return this.call("saveEventDetail", payload);
  }
  deleteEvent(event_id: string) {
    return this.call("deleteEvent", { event_id });
  }
  saveCommittee(member: Member) {
    return this.call("saveCommittee", { member });
  }
  saveOrganisation(organisation: Organisation) {
    return this.call("saveOrganisation", { organisation });
  }
  saveMeeting(meeting: Meeting, notes_file?: NotesFile) {
    return this.call("saveMeeting", { meeting, notes_file });
  }
  deleteMeeting(meeting_id: string) {
    return this.call("deleteMeeting", { meeting_id });
  }
  saveTask(task: Task) {
    return this.call("saveTask", { task });
  }
  deleteTask(task_id: string) {
    return this.call("deleteTask", { task_id });
  }
  saveTaskTemplate(template: Template) {
    return this.call("saveTaskTemplate", { template });
  }
  deleteTaskTemplate(template_id: string) {
    return this.call("deleteTaskTemplate", { template_id });
  }
}
