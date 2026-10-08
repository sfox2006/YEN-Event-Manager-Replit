export interface Row {
  created_at: string;
  updated_at: string;
}
export interface Event extends Row {
  event_id: string;
  event_name: string;
  description: string;
  event_type: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  lead_organiser_id: string;
  funding_required: string;
  room_required: string;
  registration_link: string;
  registration_numbers?: number;
  registration_capacity?: number;
  notes: string;
}
export interface Speaker extends Row {
  speaker_id: string;
  name: string;
  organisation_name: string;
  title: string;
  email: string;
  notes: string;
}
export interface EventSpeaker extends Row {
  event_speaker_id: string;
  event_id: string;
  speaker_id: string;
  invitation_status: string;
  notes: string;
}
export interface Poster extends Row {
  poster_id: string;
  event_id: string;
  title: string;
  drive_url: string;
  status: string;
  notes: string;
}
export interface Task extends Row {
  task_id: string;
  event_id: string;
  task_name: string;
  description: string;
  assignee_member_id: string;
  due_date: string;
  priority: string;
  status: string;
  notes: string;
  generated_from_template_id: string;
  due_date_offset_days?: number;
}
export interface Template extends Row {
  template_id: string;
  task_name: string;
  description: string;
  assignee_member_id: string;
  offset_days?: number;
  priority: string;
  active: boolean;
}
export interface Meeting extends Row {
  meeting_id: string;
  meeting_name: string;
  meeting_type: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  meeting_link: string;
  meeting_notes_link: string;
  meeting_notes_file_id: string;
  meeting_notes_file_name: string;
  meeting_notes_file_url: string;
  organiser_member_id: string;
  organisation_id: string;
  external_organisation: string;
  status: string;
  attendees: string;
  agenda: string;
  notes: string;
}
export interface Member extends Row {
  member_id: string;
  name: string;
  role: string;
  organisation_id: string;
  email: string;
  active: boolean;
}
export interface Attendance extends Row {
  attendance_id: string;
  event_id: string;
  member_id: string;
  attendance_status: string;
  event_role: string;
  notes: string;
}
export interface Organisation extends Row {
  organisation_id: string;
  organisation_name: string;
  acronym: string;
  contact_name: string;
  contact_email: string;
  notes: string;
  active: boolean;
}
export interface EventOrganisation extends Row {
  event_organisation_id: string;
  event_id: string;
  organisation_id: string;
  relationship_type: string;
}
export interface Funding extends Row {
  funding_id: string;
  event_id: string;
  organisation_id: string;
  source_name: string;
  status: string;
  amount_requested?: number;
  amount_confirmed?: number;
  notes: string;
}
export interface Venue extends Row {
  venue_id: string;
  event_id: string;
  venue: string;
  room: string;
  booking_status: string;
  capacity?: number;
  address: string;
  notes: string;
}
export interface Checklist extends Row {
  checklist_id: string;
  event_id: string;
  item_type: string;
  item_name: string;
  status: string;
  notes: string;
}
export type JoinedSpeaker = Speaker & EventSpeaker & { speaker_notes?: string };
export type JoinedOrganisation = Organisation & EventOrganisation;
export interface EventDetail {
  event: Event;
  speakers: JoinedSpeaker[];
  posters: Poster[];
  tasks: Task[];
  funding: Funding[];
  venue: Venue | null;
  organisations: JoinedOrganisation[];
  attendance: Attendance[];
  checklist: Checklist[];
}
export interface EventSummary extends Event {
  progress: number;
  funding_status: string;
  speaker_summary: string;
  room_status: string;
  committee_confirmed: number;
  lead_organiser_name: string;
  organisation_ids: string[];
}
export interface Bootstrap {
  events: EventSummary[];
  committee: Member[];
  organisations: Organisation[];
  meetings: Meeting[];
  tasks: Task[];
  task_templates: Template[];
}
export interface Tables {
  events: Event[];
  speakers: Speaker[];
  event_speakers: EventSpeaker[];
  posters: Poster[];
  tasks: Task[];
  task_templates: Template[];
  meetings: Meeting[];
  committee: Member[];
  attendance: Attendance[];
  organisations: Organisation[];
  event_organisations: EventOrganisation[];
  funding: Funding[];
  venues: Venue[];
  checklist: Checklist[];
}
export type DetailPayload = EventDetail & {
  base_detail: EventDetail;
  update_automated_task_deadlines: boolean;
};
export interface NotesFile {
  name: string;
  type: string;
  base64: string;
}
