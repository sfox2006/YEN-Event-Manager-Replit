import type { Tables, Event, Meeting } from "../domain/types";
import { templateSeeds } from "../domain/statuses";
import { offsetDate, localToday } from "../domain/rules";
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
export function seed(clock = new Date()): Tables {
  const today = localToday(clock),
    date = (n: number) => offsetDate(today, n),
    t: Tables = {
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
  [
    "Civic Economics Collective",
    "Future Policy Society",
    "Regional Research Forum",
    "Community Learning Network",
    "Archived Policy Circle",
  ].forEach((name, i) =>
    t.organisations.push({
      organisation_id: "org_" + i,
      organisation_name: name,
      acronym: ["CEC", "FPS", "RRF", "CLN", "APC"][i],
      contact_name: "Demo contact " + (i + 1),
      contact_email: `contact${i + 1}@example.com`,
      notes: "Synthetic demonstration organisation",
      active: i < 4,
      ...stamp(),
    }),
  );
  [
    "Alex Morgan",
    "Jamie Chen",
    "Taylor Reed",
    "Casey Lane",
    "Jordan Ellis",
    "Riley Park",
    "Robin Hayes",
  ].forEach((name, i) =>
    t.committee.push({
      member_id: "member_" + i,
      name,
      role: [
        "President",
        "Secretary",
        "Events lead",
        "Treasurer",
        "Communications",
        "Committee member",
        "Former member",
      ][i],
      organisation_id: "org_" + (i % 4),
      email: `member${i + 1}@example.com`,
      active: i < 6,
      ...stamp(),
    }),
  );
  templateSeeds.forEach(([name, offset, priority, role], i) =>
    t.task_templates.push({
      template_id: "template_" + i,
      task_name: name,
      description: "Prepare and review " + name.toLowerCase() + ".",
      assignee_member_id:
        role === "President"
          ? "member_0"
          : role === "Secretary"
            ? "member_1"
            : "",
      offset_days: offset,
      priority,
      active: i !== 1,
      ...stamp(),
    }),
  );
  [
    "Future of local economies",
    "Policy roundtable",
    "Community research evening",
    "Skills exchange",
    "Ideas workshop",
    "Annual review",
    "Cancelled seminar",
    "Open event idea",
  ].forEach((name, i) =>
    t.events.push({
      ...blankEvent(),
      event_id: "event_" + i,
      event_name: name,
      description: "A fictional event for exploring committee planning.",
      event_type: i % 2 ? "Roundtable" : "Workshop",
      date:
        i === 7 ? "" : date(i === 5 ? -10 : i === 6 ? 15 : i === 4 ? 25 : 7),
      start_time: "18:00",
      end_time: "20:00",
      status: [
        "Planning",
        "Confirmed",
        "Registrations Open",
        "Planning",
        "Completed",
        "Completed",
        "Cancelled",
        "Idea",
      ][i],
      lead_organiser_id: i === 7 ? "" : "member_" + (i % 6),
      funding_required: i === 1 ? "No" : "Yes",
      room_required: i === 1 ? "No" : "Yes",
    }),
  );
  t.funding.push({
    funding_id: "fund_0",
    event_id: "event_0",
    organisation_id: "",
    source_name: "Demo community grant",
    status: "Pending",
    amount_requested: 500,
    notes: "Awaiting fictional approval",
    ...stamp(),
  });
  t.venues.push({
    venue_id: "venue_0",
    event_id: "event_0",
    venue: "Community House",
    room: "Forum room",
    booking_status: "Tentatively booked",
    capacity: 80,
    address: "10 Example Street",
    notes: "Synthetic venue",
    ...stamp(),
  });
  ["Demo Speaker One", "Demo Speaker Two", "Demo Speaker Three"].forEach(
    (name, i) => {
      t.speakers.push({
        speaker_id: "speaker_" + i,
        name,
        organisation_name: "Example Institute",
        title: "Researcher",
        email: `speaker${i + 1}@example.com`,
        notes: "",
        ...stamp(),
      });
      t.event_speakers.push({
        event_speaker_id: "link_" + i,
        event_id: "event_0",
        speaker_id: "speaker_" + i,
        invitation_status: i < 2 ? "Confirmed" : "Invited",
        notes: "",
        ...stamp(),
      });
    },
  );
  ["Complete", "In progress", "Not applicable"].forEach((status, i) =>
    t.checklist.push({
      checklist_id: "check_" + i,
      event_id: "event_0",
      item_type: "Registration",
      item_name: [
        "Registration required",
        "Registration page created",
        "Registrations open",
      ][i],
      status,
      notes: "",
      ...stamp(),
    }),
  );
  t.event_organisations.push({
    event_organisation_id: "partner_0",
    event_id: "event_0",
    organisation_id: "org_0",
    relationship_type: "Co-host",
    ...stamp(),
  });
  t.posters.push({
    poster_id: "poster_0",
    event_id: "event_0",
    title: "Demo event poster",
    drive_url: "https://example.com/poster",
    status: "Ready for review",
    notes: "Example link only",
    ...stamp(),
  });
  for (let i = 0; i < 4; i++)
    t.attendance.push({
      attendance_id: "attend_" + i,
      event_id: "event_0",
      member_id: "member_" + i,
      attendance_status: [
        "Confirmed attending",
        "Confirmed attending",
        "Awaiting response",
        "Not attending",
      ][i],
      event_role: "",
      notes: "",
      ...stamp(),
    });
  [
    "Review event plan",
    "Prepare general agenda",
    "Confirm equipment",
    "Draft publicity",
    "Archive last event",
    "Review venue details",
  ].forEach((name, i) =>
    t.tasks.push({
      task_id: "task_" + i,
      event_id: i === 1 ? "" : "event_" + (i % 4),
      task_name: name,
      description: "Synthetic committee task",
      assignee_member_id: "member_" + i,
      due_date: i === 5 ? "" : date([-2, 0, 7, 7, -5][i]),
      priority: i === 2 ? "Urgent" : "Normal",
      status: [
        "Not started",
        "In progress",
        "Blocked",
        "Not started",
        "Complete",
        "Not started",
      ][i],
      notes: "",
      generated_from_template_id: i === 0 ? "template_0" : "",
      ...(i === 0 ? { due_date_offset_days: -30 } : {}),
      ...stamp(),
    }),
  );
  [
    "Planning catch-up",
    "Partner conversation",
    "Undated committee meeting",
    "Previous executive meeting",
    "Cancelled planning meeting",
    "Completed future meeting",
  ].forEach((name, i) =>
    t.meetings.push({
      ...blankMeeting(),
      meeting_id: "meeting_" + i,
      meeting_name: name,
      date: i === 2 ? "" : date(i === 3 ? -4 : i === 4 ? 12 : i === 5 ? 20 : 7),
      start_time: "17:00",
      end_time: "18:00",
      meeting_type:
        i === 1 ? "Meeting with another organisation" : "Executive meeting",
      organisation_id: i === 1 ? "org_1" : "",
      organiser_member_id: "member_1",
      location: "Online",
      meeting_link: "https://example.com/meeting",
      meeting_notes_link: "https://example.com/notes",
      status: i === 4 ? "Cancelled" : i === 5 ? "Completed" : "Planned",
    }),
  );
  return t;
}
