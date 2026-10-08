import { WorkbookImport } from "../components/WorkbookImport";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "../data/context";
import { Header, Panel, Metrics, Badge, Table } from "../components/ui";
import { EventTable, MeetingTable } from "../components/tables";
import { RecordEditor, type EditorKind, timing } from "../components/editors";
import { Calendar } from "../components/Calendar";
import {
  bucket,
  overdue,
  dateSort,
  utcToday,
  formatDate,
} from "../domain/rules";
import { statuses } from "../domain/statuses";
import type { Meeting, Task } from "../domain/types";
export function Dashboard() {
  const { data } = useData(),
    [editor, setEditor] = useState<{ kind: EditorKind; record?: object }>();
  const upcoming = data.events.filter((e) => bucket(e) === "upcoming"),
    meetings = data.meetings.filter((m) => bucket(m) === "upcoming");
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Where are we at with each event?"
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setEditor({ kind: "event" })}
          >
            + Add Event
          </button>
        }
      />
      <Metrics
        items={[
          ["Upcoming events", upcoming.length],
          [
            "Confirmed or open",
            upcoming.filter((e) =>
              ["Confirmed", "Registrations Open"].includes(e.status),
            ).length,
          ],
          [
            "Below 50% readiness",
            upcoming.filter((e) => e.progress < 50).length,
          ],
          [
            "Confirmed attendances",
            upcoming.reduce((s, e) => s + e.committee_confirmed, 0),
          ],
          [
            "Open committee tasks",
            data.tasks.filter((t) => t.status !== "Complete").length,
          ],
          ["Overdue tasks", data.tasks.filter((t) => overdue(t)).length],
          ["Upcoming meetings", meetings.length],
        ]}
      />
      <Calendar
        onMeeting={(record) => setEditor({ kind: "meeting", record })}
      />
      <Panel
        title="Upcoming events"
        action={<Link to="/events">View all events →</Link>}
      >
        <EventTable events={[...upcoming].sort(dateSort)} />
      </Panel>
      <Panel
        title="Next meetings"
        action={<Link to="/meetings">View all meetings →</Link>}
      >
        <MeetingTable meetings={[...meetings].sort(dateSort).slice(0, 5)} />
      </Panel>
      {editor && (
        <RecordEditor {...editor} onClose={() => setEditor(undefined)} />
      )}
    </>
  );
}
function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (s: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
const opts = (values: string[], all: string): [string, string][] => [
  ["", all],
  ...values.map((x) => [x, x] as [string, string]),
];
export function Events() {
  const { data } = useData(),
    [tab, setTab] = useState(
      () => sessionStorage.getItem("eventTab") || "upcoming",
    ),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [lead, setLead] = useState(""),
    [org, setOrg] = useState(""),
    [add, setAdd] = useState(false);
  const rows = data.events.filter(
    (e) =>
      bucket(e) === tab &&
      e.event_name.toLowerCase().includes(q.toLowerCase()) &&
      (!status || e.status === status) &&
      (!lead || e.lead_organiser_id === lead) &&
      (!org || e.organisation_ids.includes(org)),
  );
  return (
    <>
      <Header
        title="Events"
        subtitle="Plan new events and keep the full history accessible."
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setAdd(true)}
          >
            + Add Event
          </button>
        }
      />
      <div className="tabs">
        {["upcoming", "past", "cancelled"].map((t) => (
          <button
            type="button"
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              sessionStorage.setItem("eventTab", t);
              setQ("");
              setStatus("");
              setLead("");
              setOrg("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="filters">
        <label>
          <span>Search</span>
          <input
            placeholder="Search event name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <Filter
          label="Status"
          value={status}
          options={opts(statuses.event, "All statuses")}
          onChange={setStatus}
        />
        <Filter
          label="Lead organiser"
          value={lead}
          options={[
            ["", "All organisers"],
            ...data.committee.map(
              (m) => [m.member_id, m.name] as [string, string],
            ),
          ]}
          onChange={setLead}
        />
        <Filter
          label="Organisation"
          value={org}
          options={[
            ["", "All organisations"],
            ...data.organisations.map(
              (o) =>
                [o.organisation_id, o.organisation_name] as [string, string],
            ),
          ]}
          onChange={setOrg}
        />
      </div>
      <Panel title={`${tab[0].toUpperCase() + tab.slice(1)} events`}>
        <EventTable events={rows} />
      </Panel>
      {add && <RecordEditor kind="event" onClose={() => setAdd(false)} />}
    </>
  );
}
export function Meetings() {
  const { data, service, mutate, toast } = useData(),
    [tab, setTab] = useState("upcoming"),
    [q, setQ] = useState(""),
    [type, setType] = useState(""),
    [org, setOrg] = useState(""),
    [lead, setLead] = useState(""),
    [status, setStatus] = useState(""),
    [editor, setEditor] = useState<Meeting | null | undefined>();
  const upcoming = data.meetings.filter((m) => bucket(m) === "upcoming"),
    rows = data.meetings
      .filter(
        (m) =>
          bucket(m) === tab &&
          [
            m.meeting_name,
            m.location,
            m.external_organisation,
            m.attendees,
            m.agenda,
          ]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase()) &&
          (!type || m.meeting_type === type) &&
          (!org || m.organisation_id === org) &&
          (!lead || m.organiser_member_id === lead) &&
          (!status || m.status === status),
      )
      .sort((a, b) => (tab === "past" ? -1 : 1) * dateSort(a, b));
  const change = (m: Meeting, s: string) =>
    mutate(() => service.saveMeeting({ ...m, status: s })).catch((e) =>
      toast(e.message),
    );
  return (
    <>
      <Header
        title="Meetings"
        subtitle="Plan executive meetings and meetings with other organisations."
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setEditor(null)}
          >
            + Add meeting
          </button>
        }
      />
      <Metrics
        items={[
          ["Upcoming", upcoming.length],
          ["Today", upcoming.filter((m) => m.date === utcToday()).length],
          [
            "Completed",
            data.meetings.filter((m) => m.status === "Completed").length,
          ],
          [
            "Cancelled",
            data.meetings.filter((m) => m.status === "Cancelled").length,
          ],
        ]}
      />
      <div className="tabs">
        {["upcoming", "past", "cancelled"].map((t) => (
          <button
            type="button"
            key={t}
            className={t === tab ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setQ("");
              setType("");
              setOrg("");
              setLead("");
              setStatus("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="filters">
        <label>
          <span>Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search meetings"
          />
        </label>
        <Filter
          label="Meeting type"
          value={type}
          options={opts(statuses.meetingType, "All types")}
          onChange={setType}
        />
        <Filter
          label="Organisation"
          value={org}
          options={[
            ["", "All organisations"],
            ...data.organisations.map(
              (o) =>
                [o.organisation_id, o.organisation_name] as [string, string],
            ),
          ]}
          onChange={setOrg}
        />
        <Filter
          label="Organiser"
          value={lead}
          options={[
            ["", "All organisers"],
            ...data.committee.map(
              (m) => [m.member_id, m.name] as [string, string],
            ),
          ]}
          onChange={setLead}
        />
        <Filter
          label="Status"
          value={status}
          options={opts(statuses.meeting, "All statuses")}
          onChange={setStatus}
        />
      </div>
      <Panel title="Meetings">
        <MeetingTable
          meetings={rows}
          onEdit={setEditor}
          onStatus={change}
          onDelete={(m) => {
            if (
              confirm(
                `Delete meeting “${m.meeting_name}”? Uploaded external documents will remain.`,
              )
            )
              mutate(() => service.deleteMeeting(m.meeting_id)).catch((e) =>
                toast(e.message),
              );
          }}
        />
      </Panel>
      {editor !== undefined && (
        <RecordEditor
          kind="meeting"
          record={editor || undefined}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
export function TaskSections({
  tasks,
  eventMode = false,
  onEdit,
}: {
  tasks: Task[];
  eventMode?: boolean;
  onEdit: (t: Task) => void;
}) {
  const { data, service, mutate, toast, busy } = useData();
  return (
    <Table
      headers={[
        "Task",
        "Event",
        "Assigned to",
        "Due",
        "Priority",
        "Status",
        "Actions",
      ]}
      rows={[...tasks]
        .sort((a, b) =>
          eventMode
            ? Number(a.status === "Complete") -
                Number(b.status === "Complete") || dateSort(a, b)
            : dateSort(a, b),
        )
        .map((t) => [
          <>
            <strong>{t.task_name}</strong>
            <small>{t.description}</small>
            {t.generated_from_template_id && <Badge value="Automated" />}
          </>,
          data.events.find((e) => e.event_id === t.event_id)?.event_name ||
            "General",
          data.committee.find((m) => m.member_id === t.assignee_member_id)
            ?.name || "Unassigned",
          <>
            {t.due_date ? formatDate(t.due_date) : "No due date"}
            {overdue(t) && <small className="overdue">Overdue</small>}
          </>,
          <Badge value={t.priority} />,
          <select
            disabled={busy}
            aria-label={"Status for " + t.task_name}
            value={t.status}
            onChange={(e) =>
              mutate(() =>
                service.saveTask({ ...t, status: e.target.value }),
              ).catch((e) => toast(e.message))
            }
          >
            {statuses.task.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>,
          <div className="row-actions">
            <button type="button" onClick={() => onEdit(t)}>
              Edit
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirm(`Delete task “${t.task_name}”?`))
                  mutate(() => service.deleteTask(t.task_id)).catch((e) =>
                    toast(e.message),
                  );
              }}
            >
              Delete
            </button>
          </div>,
        ])}
    />
  );
}
export function Tasks() {
  const { data } = useData(),
    [q, setQ] = useState(""),
    [member, setMember] = useState(
      () => sessionStorage.getItem("taskMember") || "",
    ),
    [status, setStatus] = useState(""),
    [event, setEvent] = useState(""),
    [editor, setEditor] = useState<Task | null | undefined>();
  const rows = data.tasks.filter(
    (t) =>
      t.task_name.toLowerCase().includes(q.toLowerCase()) &&
      (!member || t.assignee_member_id === member) &&
      (!status || t.status === status) &&
      (!event || (event === "general" ? !t.event_id : t.event_id === event)),
  );
  return (
    <>
      <Header
        title="Tasks"
        subtitle="See what needs doing, who owns it, and how work is progressing."
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setEditor(null)}
          >
            + Add task
          </button>
        }
      />
      <Metrics
        items={[
          [
            "Open tasks",
            data.tasks.filter((t) => t.status !== "Complete").length,
          ],
          ["Overdue", data.tasks.filter((t) => overdue(t)).length],
          ["Blocked", data.tasks.filter((t) => t.status === "Blocked").length],
          [
            "Complete",
            data.tasks.filter((t) => t.status === "Complete").length,
          ],
        ]}
      />
      <div className="filters">
        <label>
          <span>Search tasks</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks"
          />
        </label>
        <Filter
          label="View tasks for"
          value={member}
          options={[
            ["", "Everyone"],
            ...data.committee
              .filter((m) => m.active)
              .map((m) => [m.member_id, m.name] as [string, string]),
          ]}
          onChange={(m) => {
            setMember(m);
            sessionStorage.setItem("taskMember", m);
          }}
        />
        <Filter
          label="Status"
          value={status}
          options={opts(statuses.task, "All statuses")}
          onChange={setStatus}
        />
        <Filter
          label="Event"
          value={event}
          options={[
            ["", "All events"],
            ["general", "General tasks"],
            ...data.events.map(
              (e) => [e.event_id, e.event_name] as [string, string],
            ),
          ]}
          onChange={setEvent}
        />
      </div>
      {statuses.task
        .filter((s) => !status || s === status)
        .map((s) => {
          const group = rows.filter((t) => t.status === s);
          return (
            <Panel key={s} title={`${s} (${group.length})`}>
              {group.length ? (
                <TaskSections tasks={group} onEdit={setEditor} />
              ) : (
                <div className="empty">No {s.toLowerCase()} tasks.</div>
              )}
            </Panel>
          );
        })}
      {editor !== undefined && (
        <RecordEditor
          kind="task"
          record={editor || undefined}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
export function Directory({ kind }: { kind: "member" | "organisation" }) {
  const { data } = useData(),
    [editor, setEditor] = useState<object | null | undefined>(),
    members = kind === "member";
  return (
    <>
      <Header
        title={members ? "Committee" : "Organisations"}
        subtitle={
          members
            ? "Manage active and historical organising committee members."
            : "Keep partner and sponsor names consistent across events."
        }
        action={
          <button
            type="button"
            className="primary"
            onClick={() => setEditor(null)}
          >
            + Add {kind}
          </button>
        }
      />
      <Panel title={members ? "Committee members" : "Organisation directory"}>
        {members ? (
          <Table
            headers={[
              "Name",
              "Role",
              "Organisation",
              "Email",
              "Status",
              "Actions",
            ]}
            rows={data.committee.map((m) => [
              <strong>{m.name}</strong>,
              m.role || "—",
              data.organisations.find(
                (o) => o.organisation_id === m.organisation_id,
              )?.organisation_name || "—",
              m.email || "—",
              <Badge value={m.active ? "Active" : "Inactive"} />,
              <button type="button" onClick={() => setEditor(m)}>
                Edit
              </button>,
            ])}
          />
        ) : (
          <Table
            headers={[
              "Organisation",
              "Acronym",
              "Contact",
              "Email",
              "Status",
              "Actions",
            ]}
            rows={data.organisations.map((o) => [
              <strong>{o.organisation_name}</strong>,
              o.acronym || "—",
              o.contact_name || "—",
              o.contact_email || "—",
              <Badge value={o.active ? "Active" : "Archived"} />,
              <button type="button" onClick={() => setEditor(o)}>
                Edit
              </button>,
            ])}
          />
        )}
      </Panel>
      {editor !== undefined && (
        <RecordEditor
          kind={kind}
          record={editor || undefined}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
export function Settings() {
  const { data, service, mutate, toast, install, busy } = useData(),
    [editor, setEditor] = useState<object | null | undefined>();
  return (
    <>
      <Header
        title="Settings"
        subtitle="Configure the app and optional preparation-task automation for new YEN events."
        action={
          <button
            disabled={busy}
            type="button"
            className="primary"
            onClick={() => setEditor(null)}
          >
            + Add task template
          </button>
        }
      />
      <WorkbookImport />
      <Panel title="Install the phone app">
        <p>
          {service.mode === "demo"
            ? "Local records and note uploads belong to this browser and origin."
            : "Shared records use your configured Google Sheet and Apps Script. Loading and saving require internet access."}
        </p>
        {install ? (
          <button
            disabled={busy}
            type="button"
            className="primary"
            onClick={install}
          >
            Install app
          </button>
        ) : (
          <p className="hint">
            Use your browser’s install menu when available. In iOS Safari: Share
            → Add to Home Screen → Open as Web App.
          </p>
        )}
      </Panel>
      <Panel
        title="Event task automation"
        subtitle="Only active templates apply to opt-in new events. Changes never alter existing tasks."
      >
        <Table
          headers={[
            "Task",
            "Assigned to",
            "Timing",
            "Priority",
            "Status",
            "Actions",
          ]}
          rows={[...data.task_templates]
            .sort(
              (a, b) =>
                Number(b.active) - Number(a.active) ||
                (a.offset_days || 0) - (b.offset_days || 0),
            )
            .map((t) => [
              <>
                <strong>{t.task_name}</strong>
                <small>{t.description}</small>
              </>,
              <>
                {data.committee.find(
                  (m) => m.member_id === t.assignee_member_id,
                )?.name || "Unassigned"}
                {data.committee.some(
                  (m) => m.member_id === t.assignee_member_id && !m.active,
                ) && (
                  <small>Inactive; generated tasks will be unassigned</small>
                )}
              </>,
              timing(t.offset_days!),
              <Badge value={t.priority} />,
              <Badge value={t.active ? "Active" : "Inactive"} />,
              <div className="row-actions">
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => setEditor(t)}
                >
                  Edit
                </button>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    mutate(() =>
                      service.saveTaskTemplate({ ...t, active: !t.active }),
                    ).catch((e) => toast(e.message))
                  }
                >
                  {t.active ? "Deactivate" : "Reactivate"}
                </button>
                <button
                  disabled={busy}
                  type="button"
                  className="danger"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete template “${t.task_name}”? Existing generated tasks will remain.`,
                      )
                    )
                      mutate(() =>
                        service.deleteTaskTemplate(t.template_id),
                      ).catch((e) => toast(e.message));
                  }}
                >
                  Delete
                </button>
              </div>,
            ])}
        />
      </Panel>
      {editor !== undefined && (
        <RecordEditor
          kind="template"
          record={editor || undefined}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
