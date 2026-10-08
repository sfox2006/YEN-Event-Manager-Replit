import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Fields, type FieldSpec, type Option } from "./Fields";
import { Modal, ErrorBox } from "./ui";
import { useData } from "../data/context";
import { blankEvent, blankMeeting, id, stamp } from "../data/seed";
import { statuses } from "../domain/statuses";
import { formatDate, offsetDate } from "../domain/rules";
import type {
  Event,
  Task,
  Meeting,
  Member,
  Organisation,
  Template,
  NotesFile,
} from "../domain/types";
export type EditorKind =
  | "event"
  | "task"
  | "meeting"
  | "member"
  | "organisation"
  | "template";
export function memberOptions(members: Member[], activeOnly = false): Option[] {
  return [
    ["", "Unassigned"],
    ...members
      .filter((m) => !activeOnly || m.active)
      .map(
        (m) =>
          [m.member_id, m.name + (m.active ? "" : " (inactive)")] as [
            string,
            string,
          ],
      ),
  ];
}
export function eventFields(members: Member[], selected = ""): FieldSpec[] {
  return [
    { key: "event_name", label: "Event name", required: true, wide: true },
    { key: "description", label: "Description", type: "textarea", wide: true },
    { key: "event_type", label: "Event type" },
    { key: "status", label: "Status", options: statuses.event },
    {
      key: "lead_organiser_id",
      label: "Lead organiser",
      options: memberOptions(
        members.filter((m) => m.active || m.member_id === selected),
      ),
    },
    { key: "date", label: "Date", type: "date" },
    { key: "start_time", label: "Start time", type: "time" },
    { key: "end_time", label: "End time", type: "time" },
    {
      key: "funding_required",
      label: "Funding required",
      options: statuses.required,
    },
    {
      key: "room_required",
      label: "Room required",
      options: statuses.required,
    },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}
export function blankRecord(kind: EditorKind, eventId = ""): object {
  const s = stamp();
  switch (kind) {
    case "event":
      return blankEvent();
    case "meeting":
      return blankMeeting();
    case "task":
      return {
        task_id: id("task"),
        task_name: "",
        description: "",
        event_id: eventId,
        assignee_member_id: "",
        due_date: "",
        priority: "Normal",
        status: "Not started",
        notes: "",
        generated_from_template_id: "",
        ...s,
      };
    case "member":
      return {
        member_id: id("member"),
        name: "",
        role: "",
        organisation_id: "",
        email: "",
        active: true,
        ...s,
      };
    case "organisation":
      return {
        organisation_id: id("org"),
        organisation_name: "",
        acronym: "",
        contact_name: "",
        contact_email: "",
        notes: "",
        active: true,
        ...s,
      };
    case "template":
      return {
        template_id: id("template"),
        task_name: "",
        description: "",
        assignee_member_id: "",
        offset_days: -30,
        priority: "Normal",
        active: true,
        ...s,
      };
  }
}
export function RecordEditor({
  kind,
  record,
  onClose,
  onSaved,
}: {
  kind: EditorKind;
  record?: object;
  onClose: () => void;
  onSaved?: (record: any) => void;
}) {
  const { data, service, mutate, toast } = useData(),
    navigate = useNavigate();
  const [value, setValue] = useState<Record<string, any>>(() =>
      structuredClone(record || blankRecord(kind)),
    ),
    [auto, setAuto] = useState(false),
    [file, setFile] = useState<File>(),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const members = memberOptions(data.committee),
    orgs: Option[] = [
      ["", "None / YEN Executive"],
      ...data.organisations.map(
        (o) =>
          [
            o.organisation_id,
            o.organisation_name + (o.active ? "" : " (archived)"),
          ] as [string, string],
      ),
    ],
    active: Option[] = [
      ["true", "Active"],
      ["false", kind === "organisation" ? "Archived" : "Inactive"],
    ];
  const spec: Record<EditorKind, FieldSpec[]> = {
    event: eventFields(data.committee),
    task: [
      { key: "task_name", label: "Task name", required: true, wide: true },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        wide: true,
      },
      { key: "assignee_member_id", label: "Assign to", options: members },
      {
        key: "event_id",
        label: "Event",
        options: [
          ["", "General task"],
          ...data.events.map(
            (e) => [e.event_id, e.event_name] as [string, string],
          ),
        ],
      },
      { key: "due_date", label: "Due date", type: "date" },
      { key: "priority", label: "Priority", options: statuses.priority },
      { key: "status", label: "Status", options: statuses.task },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    meeting: [
      {
        key: "meeting_name",
        label: "Meeting title",
        required: true,
        wide: true,
      },
      {
        key: "meeting_type",
        label: "Meeting type",
        options: statuses.meetingType,
      },
      { key: "status", label: "Status", options: statuses.meeting },
      { key: "organiser_member_id", label: "YEN organiser", options: members },
      { key: "date", label: "Date", type: "date" },
      { key: "start_time", label: "Start time", type: "time" },
      { key: "end_time", label: "End time", type: "time" },
      {
        key: "organisation_id",
        label: "Organisation meeting with",
        options: orgs,
      },
      { key: "external_organisation", label: "Other organisation name" },
      { key: "location", label: "Location" },
      { key: "meeting_link", label: "Online meeting link", type: "url" },
      { key: "meeting_notes_link", label: "Meeting notes link", type: "url" },
      { key: "attendees", label: "Expected attendees", wide: true },
      {
        key: "agenda",
        label: "Purpose and agenda",
        type: "textarea",
        wide: true,
      },
      {
        key: "notes",
        label: "Decisions and actions",
        type: "textarea",
        wide: true,
      },
    ],
    member: [
      { key: "name", label: "Name", required: true, wide: true },
      { key: "role", label: "Position / role" },
      { key: "organisation_id", label: "Organisation", options: orgs },
      { key: "email", label: "Email", type: "email" },
      { key: "active", label: "Status", options: active },
    ],
    organisation: [
      {
        key: "organisation_name",
        label: "Organisation name",
        required: true,
        wide: true,
      },
      { key: "acronym", label: "Acronym" },
      { key: "contact_name", label: "Contact person" },
      { key: "contact_email", label: "Contact email", type: "email" },
      { key: "active", label: "Status", options: active },
      { key: "notes", label: "Notes", type: "textarea", wide: true },
    ],
    template: [
      { key: "task_name", label: "Task name", required: true, wide: true },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        wide: true,
      },
      { key: "assignee_member_id", label: "Assign to", options: members },
      {
        key: "offset_days",
        label: "Timing in days",
        type: "number",
        min: -3650,
        max: 3650,
        step: "1",
        required: true,
      },
      { key: "priority", label: "Priority", options: statuses.priority },
      { key: "active", label: "Status", options: active },
    ],
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      let notes: NotesFile | undefined;
      if (file) {
        const types: Record<string, string> = {
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (
          !file.size ||
          file.size > 8 * 1024 * 1024 ||
          types[ext] !== file.type
        )
          throw new Error("Choose a nonempty PDF/DOC/DOCX up to 8 MiB.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        notes = { name: file.name, type: file.type, base64: btoa(binary) };
      }
      const saved = await mutate<
        Event | Task | Meeting | Member | Organisation | Template
      >(() => {
        switch (kind) {
          case "event":
            return auto
              ? service.createEventWithAutomation(value as Event)
              : service.saveEvent(value as Event);
          case "task":
            return service.saveTask(value as Task);
          case "meeting":
            return service.saveMeeting(value as Meeting, notes);
          case "member":
            return service.saveCommittee(value as Member);
          case "organisation":
            return service.saveOrganisation(value as Organisation);
          case "template":
            return service.saveTaskTemplate(value as Template);
        }
      });
      toast("Saved successfully");
      onSaved?.(saved);
      onClose();
      if (kind === "event") navigate("/event/" + (saved as Event).event_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const title =
    kind === "event"
      ? "Add Event"
      : `${record ? "Edit" : "Add"} ${kind === "template" ? "task template" : kind === "member" ? "member" : kind}`;
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <Fields
            spec={spec[kind]}
            value={value}
            onChange={(key, v) => setValue({ ...value, [key]: v })}
          />
          {kind === "template" && (
            <p className="hint">
              Negative days are before the event; zero is the event date;
              positive days are after. Template changes never alter existing
              tasks.
            </p>
          )}
          {kind === "event" && (
            <div className="automation">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={!data.task_templates.some((t) => t.active)}
                  onChange={(e) => setAuto(e.target.checked)}
                />{" "}
                Create preparation tasks automatically
              </label>
              <p className="hint">
                Only active templates apply. Manage them in Settings.
              </p>
              {auto &&
                (value.date ? (
                  <div>
                    <strong>
                      {data.task_templates.filter((t) => t.active).length}{" "}
                      preparation tasks
                    </strong>
                    <ul className="preview">
                      {data.task_templates
                        .filter((t) => t.active)
                        .map((t) => (
                          <li key={t.template_id}>
                            <strong>{t.task_name}</strong>
                            <span>
                              {data.committee.find(
                                (m) =>
                                  m.member_id === t.assignee_member_id &&
                                  m.active,
                              )?.name || "Unassigned"}{" "}
                              · {timing(t.offset_days!)} ·{" "}
                              {formatDate(
                                offsetDate(value.date, t.offset_days!),
                              )}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : (
                  <p>Choose an event date to preview the task deadlines.</p>
                ))}
            </div>
          )}
          {kind === "meeting" && (
            <label className="file-label">
              Upload meeting notes file
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
              <small>
                {value.meeting_notes_file_name
                  ? `Current upload: ${value.meeting_notes_file_name}. Choosing a file replaces it.`
                  : "PDF, DOC or DOCX, up to 8 MiB."}{" "}
                {service.mode === "demo"
                  ? "Local uploads stay in this browser."
                  : "Replacement trashes the previous Drive upload. Deleting the meeting leaves its file."}
              </small>
            </label>
          )}
          {error && <ErrorBox message={error} />}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={kind === "event" && auto && !value.date}
            >
              {saving
                ? "Saving…"
                : kind === "event"
                  ? "Create event"
                  : "Save changes"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
export const timing = (n: number) =>
  n === 0
    ? "On event date"
    : `${Math.abs(n)} days ${n < 0 ? "before" : "after"} event`;
