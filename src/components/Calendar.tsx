import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../data/context";
import { Panel } from "./ui";
import { localToday } from "../domain/rules";
import type { Meeting } from "../domain/types";
export function Calendar({ onMeeting }: { onMeeting: (m: Meeting) => void }) {
  const { data } = useData(),
    navigate = useNavigate(),
    [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );
  const first = new Date(month);
  first.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });
  const entries = [
    ...data.events
      .filter((e) => e.date)
      .map((e) => ({
        date: e.date,
        id: e.event_id,
        name: e.event_name,
        type: "Event",
        class: "event",
        muted: ["Completed", "Cancelled"].includes(e.status),
        open: () => navigate("/event/" + e.event_id),
      })),
    ...data.meetings
      .filter((m) => m.date)
      .map((m) => ({
        date: m.date,
        id: m.meeting_id,
        name: m.meeting_name,
        type: "Meeting",
        class: "meeting",
        muted: ["Completed", "Cancelled"].includes(m.status),
        open: () => onMeeting(m),
      })),
    ...data.tasks
      .filter((t) => t.due_date)
      .map((t) => ({
        date: t.due_date,
        id: t.task_id,
        name: t.task_name,
        type: "Task deadline",
        class: "task",
        muted: t.status === "Complete",
        open: () => navigate("/tasks"),
      })),
  ];
  const tile = (e: (typeof entries)[number]) => (
    <button
      key={e.id}
      title={e.type + ": " + e.name}
      className={"calendar-entry " + e.class + (e.muted ? " muted" : "")}
      onClick={e.open}
    >
      <strong>{e.name}</strong>
      <small>{e.type}</small>
    </button>
  );
  return (
    <Panel
      title="Committee calendar"
      subtitle="Events, meetings and task deadlines"
      action={
        <div className="calendar-controls">
          <button
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <button
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            Today
          </button>
          <strong>
            {month.toLocaleDateString("en-AU", {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
      }
    >
      <div className="legend">
        <span className="event">● Event</span>
        <span className="meeting">● Meeting</span>
        <span className="task">● Task deadline</span>
      </div>
      <div className="calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div className="weekday" key={d}>
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = localToday(day),
            rows = entries.filter((e) => e.date === key),
            outside = day.getMonth() !== month.getMonth(),
            today = key === localToday();
          return (
            <div
              className={
                "calendar-day" +
                (outside ? " outside" : "") +
                (!rows.length && !today ? " no-entries" : "")
              }
              key={key}
            >
              <span className={"day-number" + (today ? " today" : "")}>
                {day.getDate()}
              </span>
              <div className="day-entries">
                {rows.slice(0, 4).map(tile)}
                {rows.length > 4 && (
                  <details>
                    <summary>+{rows.length - 4} more</summary>
                    {rows.slice(4).map(tile)}
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!entries.some((e) =>
        e.date.startsWith(localToday(month).slice(0, 7)),
      ) && <div className="empty">Nothing is scheduled in this month.</div>}
    </Panel>
  );
}
