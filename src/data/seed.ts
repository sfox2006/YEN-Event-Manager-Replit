import type { Tables, Event, Meeting } from "../domain/types";
export const stamp = () => {
  const now = new Date().toISOString();
  return { created_at: now, updated_at: now };
};
export const id = (prefix: string) => prefix + "_" + crypto.randomUUID();
export function blankEvent(): Event {
  return {
    event_id: id("event"),
    event_name: "",
    description: "",
    event_type: "",
    date: "",
    start_time: "",
    end_time: "",
    status: "Idea",
    lead_organiser_id: "",
    funding_required: "Unknown",
    room_required: "Unknown",
    registration_link: "",
    notes: "",
    ...stamp(),
  };
}
export function blankMeeting(): Meeting {
  return {
    meeting_id: id("meeting"),
    meeting_name: "",
    meeting_type: "Executive meeting",
    date: "",
    start_time: "",
    end_time: "",
    location: "",
    meeting_link: "",
    meeting_notes_link: "",
    meeting_notes_file_id: "",
    meeting_notes_file_name: "",
    meeting_notes_file_url: "",
    organiser_member_id: "",
    organisation_id: "",
    external_organisation: "",
    status: "Planned",
    attendees: "",
    agenda: "",
    notes: "",
    ...stamp(),
  };
}
export function seed(): Tables {
  return {
    events: [],
    speakers: [],
    event_speakers: [],
    posters: [],
    tasks: [],
    task_templates: [],
    meetings: [],
    committee: [],
    attendance: [],
    organisations: [],
    event_organisations: [],
    funding: [],
    venues: [],
    checklist: [],
  };
}
