import { useState } from "react";
import { useData } from "../data/context";
import { taskEmail } from "../domain/taskReminder";
import { id } from "../data/seed";
import type { Task } from "../domain/types";
export function TaskReminderActions({ task }: { task: Task }) {
  const { data, service, toast } = useData(),
    [pending, setPending] = useState(false),
    [requestId, setRequestId] = useState(() => id("announcement"));
  const member = data.committee.find(
      (m) => m.member_id === task.assignee_member_id,
    ),
    email = taskEmail(task, member);
  return (
    <>
      <button
        type="button"
        disabled={!member || pending}
        title={
          member
            ? "Add a reminder to this member’s Announcements"
            : "Assign a committee member first"
        }
        onClick={async () => {
          setPending(true);
          try {
            await service.sendTaskReminder(task.task_id, requestId);
            setRequestId(id("announcement"));
            toast(
              service.mode === "demo"
                ? "Reminder added to this member’s local Announcements"
                : "Reminder added to this member’s shared Announcements",
            );
          } catch (e) {
            toast((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Adding…" : "Send reminder"}
      </button>
      {email ? (
        <a
          className="email-button"
          href={email}
          title="Open a draft in your default email app"
        >
          Email reminder
        </a>
      ) : (
        <button
          type="button"
          disabled
          title={
            member
              ? "Add a valid email address to this member in Committee"
              : "Assign a committee member first"
          }
        >
          Email reminder
        </button>
      )}
    </>
  );
}
