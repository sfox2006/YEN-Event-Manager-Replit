import type { Tables } from "../domain/types";
const oldIds: Record<keyof Tables, string[]> = {
  events: Array.from({ length: 8 }, (_, i) => "event_" + i),
  committee: Array.from({ length: 7 }, (_, i) => "member_" + i),
  organisations: Array.from({ length: 5 }, (_, i) => "org_" + i),
  task_templates: Array.from({ length: 19 }, (_, i) => "template_" + i),
  speakers: Array.from({ length: 3 }, (_, i) => "speaker_" + i),
  event_speakers: Array.from({ length: 3 }, (_, i) => "link_" + i),
  posters: ["poster_0"],
  tasks: Array.from({ length: 6 }, (_, i) => "task_" + i),
  meetings: Array.from({ length: 6 }, (_, i) => "meeting_" + i),
  attendance: Array.from({ length: 4 }, (_, i) => "attend_" + i),
  event_organisations: ["partner_0"],
  funding: ["fund_0"],
  venues: ["venue_0"],
  checklist: Array.from({ length: 3 }, (_, i) => "check_" + i),
};
const primary: Record<keyof Tables, string> = {
  events: "event_id",
  committee: "member_id",
  organisations: "organisation_id",
  task_templates: "template_id",
  speakers: "speaker_id",
  event_speakers: "event_speaker_id",
  posters: "poster_id",
  tasks: "task_id",
  meetings: "meeting_id",
  attendance: "attendance_id",
  event_organisations: "event_organisation_id",
  funding: "funding_id",
  venues: "venue_id",
  checklist: "checklist_id",
};
export function removeSynthetic(t: Tables): Tables {
  const out = structuredClone(t);
  for (const key of Object.keys(out) as (keyof Tables)[]) {
    (out[key] as unknown as Record<string, unknown>[]) = (
      out[key] as unknown as Record<string, unknown>[]
    ).filter(
      (r) =>
        !oldIds[key].includes(String(r[primary[key]])) &&
        !(
          key !== "events" &&
          key !== "tasks" &&
          oldIds.events.includes(String(r.event_id))
        ),
    );
    for (const r of out[key] as unknown as Record<string, unknown>[]) {
      if (oldIds.events.includes(String(r.event_id)) && key === "tasks")
        r.event_id = "";
      for (const field of [
        "lead_organiser_id",
        "assignee_member_id",
        "organiser_member_id",
        "member_id",
      ])
        if (
          field !== primary[key] &&
          oldIds.committee.includes(String(r[field]))
        )
          r[field] = "";
      if (
        key !== "organisations" &&
        oldIds.organisations.includes(String(r.organisation_id))
      )
        r.organisation_id = "";
    }
  }
  return out;
}
