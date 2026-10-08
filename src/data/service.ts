import type {
  Bootstrap,
  EventDetail,
  Event,
  DetailPayload,
  Member,
  Organisation,
  Meeting,
  Task,
  Template,
  NotesFile,
} from "../domain/types";
export interface DataService {
  mode: "demo" | "google";
  getBootstrap(): Promise<Bootstrap>;
  getEvent(id: string): Promise<EventDetail>;
  saveEvent(e: Event): Promise<Event>;
  createEventWithAutomation(e: Event): Promise<Event>;
  saveEventDetail(p: DetailPayload): Promise<EventDetail>;
  deleteEvent(id: string): Promise<void>;
  saveCommittee(m: Member): Promise<Member>;
  saveOrganisation(o: Organisation): Promise<Organisation>;
  saveMeeting(m: Meeting, file?: NotesFile): Promise<Meeting>;
  deleteMeeting(id: string): Promise<void>;
  saveTask(t: Task): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  saveTaskTemplate(t: Template): Promise<Template>;
  deleteTaskTemplate(id: string): Promise<void>;
  openNotes?(id: string): Promise<void>;
}
