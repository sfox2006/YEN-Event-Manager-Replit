import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useData } from "../data/context";
import { Panel, Header, Badge, ErrorBox } from "../components/ui";
import { Fields, type FieldSpec } from "../components/Fields";
import { eventFields, RecordEditor, blankRecord } from "../components/editors";
import { TaskSections } from "./Lists";
import { SafeLink } from "../components/tables";
import { id, stamp } from "../data/seed";
import { checklistGroups, statuses } from "../domain/statuses";
import { readiness, formatDate } from "../domain/rules";
import { cache } from "../data/readCache";
import type { EventDetail, Task } from "../domain/types";
function placeholders(
  d: EventDetail,
  members: ReturnType<typeof useData>["data"]["committee"],
): EventDetail {
  const result = structuredClone(d);
  if (!result.venue)
    result.venue = {
      venue_id: id("venue"),
      event_id: d.event.event_id,
      venue: "",
      room: "",
      booking_status: "Not started",
      address: "",
      notes: "",
      ...stamp(),
    };
  for (const m of members.filter((m) => m.active)) {
    if (!result.attendance.some((a) => a.member_id === m.member_id))
      result.attendance.push({
        attendance_id: id("attendance"),
        event_id: d.event.event_id,
        member_id: m.member_id,
        attendance_status: "Not asked",
        event_role: "",
        notes: "",
        ...stamp(),
      });
  }
  for (const [group, names] of Object.entries(checklistGroups))
    for (const name of names)
      if (!result.checklist.some((c) => c.item_name === name))
        result.checklist.push({
          checklist_id: id("checklist"),
          event_id: d.event.event_id,
          item_type: group,
          item_name: name,
          status: "Not started",
          notes: "",
          ...stamp(),
        });
  return result;
}
export function EventWorkspace() {
  const { id: eventId } = useParams(),
    navigate = useNavigate(),
    { data, service, mutate, toast } = useData();
  const [saved, setSaved] = useState<EventDetail>(),
    [draft, setDraft] = useState<EventDetail>(),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [exporting, setExporting] = useState(false),
    [taskEditor, setTaskEditor] = useState<Task>();
  useEffect(() => {
    let alive = true;
    setSaved(undefined);
    setDraft(undefined);
    setError("");
    cache
      .read("event:" + eventId, () => service.getEvent(eventId!))
      .then((d) => {
        if (alive) {
          setSaved(d);
          setDraft(placeholders(d, data.committee));
          setDirty(false);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [eventId, service]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    let approved = false;
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (
        a?.getAttribute("href")?.startsWith("#/") &&
        a.getAttribute("href") !== location.hash &&
        !(approved = confirm("Discard unsaved event changes?"))
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    let previous = location.hash;
    const hash = () => {
      if (location.hash !== previous && !approved) {
        if (!confirm("Discard unsaved event changes?")) {
          history.replaceState(null, "", previous);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } else previous = location.hash;
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
      window.removeEventListener("hashchange", hash);
    };
  }, [dirty]);
  if (!draft || !saved)
    return (
      <>
        {error ? (
          <>
            <ErrorBox message={error} />
            <Link to="/events">All events</Link>
            <button
              onClick={() => {
                cache.invalidate();
                navigate(0);
              }}
            >
              Retry
            </button>
          </>
        ) : (
          <p>Loading event workspace…</p>
        )}
      </>
    );
  const change = (
    section: keyof EventDetail,
    key: string,
    value: unknown,
    index?: number,
  ) => {
    setDraft((d) => {
      const next = structuredClone(d!);
      if (index !== undefined)
        (next[section] as unknown as Record<string, unknown>[])[index][key] =
          value;
      else (next[section] as unknown as Record<string, unknown>)[key] = value;
      return next;
    });
    setDirty(true);
  };
  function add(section: "funding" | "speakers" | "posters" | "organisations") {
    const base = { event_id: eventId!, ...stamp() };
    const row =
      section === "funding"
        ? {
            ...base,
            funding_id: id("funding"),
            organisation_id: "",
            source_name: "",
            status: "Pending",
            notes: "",
          }
        : section === "speakers"
          ? {
              ...base,
              event_speaker_id: id("speakerlink"),
              speaker_id: id("speaker"),
              name: "",
              organisation_name: "",
              title: "",
              email: "",
              notes: "",
              invitation_status: "Not contacted",
            }
          : section === "posters"
            ? {
                ...base,
                poster_id: id("poster"),
                title: "",
                drive_url: "",
                status: "Draft requested",
                notes: "",
              }
            : {
                ...base,
                event_organisation_id: id("partner"),
                organisation_id: "",
                relationship_type: "Organiser",
                organisation_name: "",
                acronym: "",
                contact_name: "",
                contact_email: "",
                notes: "",
                active: true,
              };
    setDraft((d) => ({ ...d!, [section]: [...d![section], row] }));
    setDirty(true);
  }
  const remove = (
    section: "funding" | "speakers" | "posters" | "organisations",
    i: number,
  ) => {
    setDraft((d) => ({
      ...d!,
      [section]: d![section].filter((_, j) => j !== i),
    }));
    setDirty(true);
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const recalc =
        !!draft!.event.date &&
        draft!.event.date !== saved!.event.date &&
        data.tasks.some(
          (t) =>
            t.event_id === eventId &&
            t.generated_from_template_id &&
            t.status !== "Complete",
        )
          ? confirm(
              "Recalculate incomplete automated task deadlines from the new event date? Manual tasks and Complete generated tasks keep their deadlines.",
            )
          : false;
      const d = await mutate(() =>
        service.saveEventDetail({
          ...draft!,
          base_detail: saved!,
          update_automated_task_deadlines: recalc,
        }),
      );
      setSaved(d);
      setDraft(placeholders(d, data.committee));
      setDirty(false);
      toast("All changes saved");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function download() {
    if (dirty) {
      setError("Save your changes before downloading the Excel file.");
      return;
    }
    setExporting(true);
    try {
      const d = await service.getEvent(eventId!);
      const { downloadEvent } = await import("../export/eventExcel");
      await downloadEvent(d, data);
      toast("Excel file prepared");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const repeated = (
    section: "funding" | "speakers" | "posters" | "organisations",
    title: string,
    spec: FieldSpec[],
    button: string,
  ) => (
    <Panel
      id={section}
      title={title}
      action={
        <button type="button" onClick={() => add(section)}>
          {button}
        </button>
      }
    >
      {section === "posters" && (
        <p className="hint">
          Paste a shareable Google Drive link and verify its viewing
          permissions. Linked files remain external.
        </p>
      )}
      {section === "organisations" && (
        <p className="hint">
          Create new directory entries on the Organisations page first.
        </p>
      )}
      {draft[section].map((row, i) => (
        <div
          className="repeat-row"
          key={String(
            (row as unknown as Record<string, unknown>)[
              {
                funding: "funding_id",
                speakers: "event_speaker_id",
                posters: "poster_id",
                organisations: "event_organisation_id",
              }[section]
            ],
          )}
        >
          <Fields
            spec={spec}
            value={row}
            onChange={(k, v) => change(section, k, v, i)}
          />
          {section === "posters" && (
            <SafeLink url={draft.posters[i].drive_url}>Open poster</SafeLink>
          )}
          <button
            type="button"
            className="danger"
            onClick={() => remove(section, i)}
          >
            Remove
          </button>
        </div>
      ))}
    </Panel>
  );
  const funds: FieldSpec[] = [
    { key: "source_name", label: "Source" },
    { key: "status", label: "Status", options: statuses.funding },
    {
      key: "amount_requested",
      label: "Requested (AUD)",
      type: "number",
      min: 0,
      step: "0.01",
    },
    {
      key: "amount_confirmed",
      label: "Confirmed (AUD)",
      type: "number",
      min: 0,
      step: "0.01",
    },
    { key: "notes", label: "Notes", type: "textarea", wide: true },
  ];
  return (
    <>
      <Link to="/events">← All events</Link>
      <Header
        title={saved.event.event_name}
        subtitle={`${formatDate(saved.event.date)} · ${saved.event.start_time || "Time TBC"} · ${saved.event.status}`}
        action={
          <div className="row-actions">
            <Badge value={`${readiness(saved)}% ready`} />
            <button disabled={exporting} onClick={download}>
              {exporting ? "Preparing…" : "Download Excel"}
            </button>
            <button
              className="danger"
              onClick={async () => {
                if (
                  confirm(
                    `Permanently delete “${saved.event.event_name}” and all linked event records? This cannot be undone. Directory entries and external documents remain.`,
                  )
                ) {
                  try {
                    await mutate(() => service.deleteEvent(eventId!));
                    setDirty(false);
                    navigate("/events");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }
              }}
            >
              Permanently delete event
            </button>
          </div>
        }
      />
      <div className="workspace">
        <form onSubmit={save} data-dirty={dirty}>
          <fieldset disabled={saving}>
            <Panel id="basic" title="Basic details">
              <Fields
                spec={eventFields(
                  data.committee,
                  draft.event.lead_organiser_id,
                )}
                value={draft.event}
                onChange={(k, v) => change("event", k, v)}
              />
            </Panel>
            {repeated("funding", "Funding", funds, "+ Add funding source")}
            {repeated(
              "speakers",
              `Speakers – ${saved.speakers.filter((s) => s.invitation_status === "Confirmed").length}/${saved.speakers.filter((s) => !["Declined", "Withdrawn"].includes(s.invitation_status)).length}`,
              [
                { key: "name", label: "Name" },
                { key: "organisation_name", label: "Organisation" },
                { key: "title", label: "Title / position" },
                {
                  key: "invitation_status",
                  label: "Status",
                  options: statuses.speaker,
                },
                { key: "email", label: "Email", type: "email" },
                { key: "notes", label: "Notes", type: "textarea", wide: true },
              ],
              "+ Add speaker",
            )}
            {repeated(
              "posters",
              "Posters",
              [
                { key: "title", label: "Poster title" },
                { key: "drive_url", label: "Google Drive link", type: "url" },
                { key: "status", label: "Status", options: statuses.poster },
                { key: "notes", label: "Notes", type: "textarea", wide: true },
              ],
              "+ Add poster link",
            )}
            <Panel id="venue" title="Room / venue">
              <Fields
                spec={[
                  { key: "venue", label: "Venue" },
                  { key: "room", label: "Room" },
                  {
                    key: "booking_status",
                    label: "Booking status",
                    options: statuses.venue,
                  },
                  {
                    key: "capacity",
                    label: "Capacity",
                    type: "number",
                    min: 0,
                    step: "1",
                  },
                  { key: "address", label: "Address" },
                  {
                    key: "notes",
                    label: "Venue notes",
                    type: "textarea",
                    wide: true,
                  },
                ]}
                value={draft.venue!}
                onChange={(k, v) => change("venue", k, v)}
              />
            </Panel>
            {repeated(
              "organisations",
              "Organisations involved",
              [
                {
                  key: "organisation_id",
                  label: "Organisation",
                  options: [
                    ["", "Select organisation"],
                    ...data.organisations
                      .filter(
                        (o) =>
                          o.active ||
                          draft.organisations.some(
                            (x) => x.organisation_id === o.organisation_id,
                          ),
                      )
                      .map(
                        (o) =>
                          [
                            o.organisation_id,
                            o.organisation_name +
                              (o.active ? "" : " (archived)"),
                          ] as [string, string],
                      ),
                  ],
                },
                {
                  key: "relationship_type",
                  label: "Relationship",
                  options: statuses.relationship,
                },
              ],
              "+ Associate organisation",
            )}
            <Panel
              id="attendance"
              title={`Committee attendance – ${saved.attendance.filter((a) => a.attendance_status === "Confirmed attending").length} confirmed / ${saved.attendance.filter((a) => a.attendance_status === "Awaiting response").length} awaiting / ${saved.attendance.filter((a) => a.attendance_status === "Not attending").length} unavailable`}
            >
              {draft.attendance.map((a, i) => {
                const m = data.committee.find(
                  (m) => m.member_id === a.member_id,
                );
                return (
                  <div className="repeat-row" key={a.attendance_id}>
                    <strong>
                      {m?.name}{" "}
                      <small>
                        {m?.role}
                        {m && !m.active ? " (inactive)" : ""}
                      </small>
                    </strong>
                    <Fields
                      spec={[
                        {
                          key: "attendance_status",
                          label: "Attendance status",
                          options: statuses.attendance,
                        },
                        { key: "event_role", label: "Event role" },
                        { key: "notes", label: "Notes" },
                      ]}
                      value={a}
                      onChange={(k, v) => change("attendance", k, v, i)}
                    />
                  </div>
                );
              })}
            </Panel>
            <Panel
              id="tasks"
              title="Tasks"
              action={
                <div className="row-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setTaskEditor(blankRecord("task", eventId) as Task)
                    }
                  >
                    + Add task
                  </button>
                  <Link to="/tasks">View all tasks</Link>
                </div>
              }
            >
              <TaskSections
                eventMode
                tasks={data.tasks.filter((t) => t.event_id === eventId)}
                onEdit={setTaskEditor}
              />
            </Panel>
            <Panel id="checklist" title="Event checklist">
              <Fields
                spec={[
                  {
                    key: "registration_link",
                    label: "Registration URL",
                    type: "url",
                  },
                  {
                    key: "registration_numbers",
                    label: "Current registrations",
                    type: "number",
                    min: 0,
                    step: "1",
                  },
                  {
                    key: "registration_capacity",
                    label: "Registration capacity",
                    type: "number",
                    min: 0,
                    step: "1",
                  },
                ]}
                value={draft.event}
                onChange={(k, v) => change("event", k, v)}
              />
              {Object.entries(checklistGroups).map(([group, names]) => (
                <div key={group}>
                  <h3>{group}</h3>
                  {names.map((name) => {
                    const i = draft.checklist.findIndex(
                        (c) => c.item_name === name,
                      ),
                      row = draft.checklist[i];
                    return (
                      <div className="checklist-row" key={row.checklist_id}>
                        <strong>{name}</strong>
                        <Fields
                          spec={[
                            {
                              key: "status",
                              label: "Status",
                              options: statuses.checklist,
                            },
                            { key: "notes", label: "Notes" },
                          ]}
                          value={row}
                          onChange={(k, v) => change("checklist", k, v, i)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </Panel>
          </fieldset>
          <div className="save-bar">
            <span>
              {saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : "No unsaved changes"}
            </span>
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save all changes"}
            </button>
          </div>
          {error && <ErrorBox message={error} />}
        </form>
        <aside>
          <strong>Event workspace</strong>
          {[
            "Basic",
            "Funding",
            "Speakers",
            "Posters",
            "Venue",
            "Organisations",
            "Attendance",
            "Tasks",
            "Checklist",
          ].map((label) => (
            <button
              key={label}
              onClick={() =>
                document
                  .getElementById(label.toLowerCase())
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {label}
            </button>
          ))}
        </aside>
      </div>
      {taskEditor && (
        <RecordEditor
          kind="task"
          record={taskEditor}
          onClose={() => setTaskEditor(undefined)}
        />
      )}
    </>
  );
}
