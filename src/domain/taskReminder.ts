import type { Task, Member, Announcement } from "./types";
import { formatDate } from "./rules";
export const validEmail = (email: string) =>
  /^[^\s@,;<>]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
export function reminderText(task: Task, member: Member) {
  return `Hi ${member.name},\n\nThis is a reminder about your task: ${task.task_name}.\nDue date: ${task.due_date ? formatDate(task.due_date) : "No due date set"}\n${task.description ? "\nDescription: " + task.description + "\n" : ""}\nNotes: ${task.notes || "No notes provided."}\n\nThank you.`;
}
export function taskEmail(task: Task, member?: Member) {
  if (!member || !validEmail(member.email.trim())) return null;
  const subject = `Reminder: ${task.task_name} — ${task.due_date ? "due " + formatDate(task.due_date) : "no due date set"}`;
  return `mailto:${encodeURIComponent(member.email.trim()).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reminderText(task, member))}`;
}
export function makeAnnouncement(
  task: Task,
  member: Member,
  announcement_id: string,
  clock = new Date(),
): Announcement {
  if (!task.assignee_member_id || task.assignee_member_id !== member.member_id)
    throw new Error(
      "Assign this task to a committee member before adding a reminder.",
    );
  const now = clock.toISOString();
  return {
    announcement_id,
    member_id: member.member_id,
    task_id: task.task_id,
    task_name: task.task_name,
    due_date: task.due_date,
    notes: task.notes,
    message: reminderText(task, member),
    read_at: "",
    created_at: now,
    updated_at: now,
  };
}
