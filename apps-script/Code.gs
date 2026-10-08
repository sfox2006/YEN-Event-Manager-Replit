// Optional owner-deployed backend. Never connects to the original live system.
const statuses = {
  event: [
    "Idea",
    "Planning",
    "Confirmed",
    "Registrations Open",
    "Completed",
    "Cancelled",
  ],
  attendance: [
    "Confirmed attending",
    "Likely attending",
    "Awaiting response",
    "Not attending",
    "Not asked",
  ],
  speaker: [
    "Not contacted",
    "Invitation to be sent",
    "Invited",
    "Follow-up required",
    "Confirmed",
    "Declined",
    "Withdrawn",
  ],
  poster: [
    "Draft requested",
    "In progress",
    "Ready for review",
    "Approved",
    "Published",
    "Not required",
  ],
  meeting: ["Planned", "Confirmed", "Completed", "Cancelled"],
  meetingType: [
    "Executive meeting",
    "Meeting with another organisation",
    "Other meeting",
  ],
  task: ["Not started", "In progress", "Blocked", "Complete"],
  priority: ["Low", "Normal", "High", "Urgent"],
  venue: [
    "Not started",
    "Requested",
    "Tentatively booked",
    "Confirmed",
    "Not required",
  ],
  checklist: ["Not started", "In progress", "Complete", "Not applicable"],
  funding: ["No", "Pending", "Confirmed", "N/A"],
  required: ["Unknown", "Yes", "No"],
  relationship: [
    "Organiser",
    "Co-host",
    "Sponsor",
    "Venue partner",
    "Promotional partner",
    "Other",
  ],
};
const checklistGroups = {
  Registration: [
    "Registration required",
    "Registration page created",
    "Registrations open",
  ],
  Marketing: [
    "Event graphic/poster",
    "Email promotion",
    "Social media promotion",
    "Partner promotion",
  ],
  Operations: [
    "AV requirements confirmed",
    "Catering required",
    "Catering confirmed",
    "Photographer required",
    "Name tags required",
    "Run sheet completed",
  ],
};
const templateSeeds = [
  ["Agree event plan and approval", -30, "High", "President"],
  ["Confirm food budget", -60, "High", ""],
  ["Confirm venue and room booking", -60, "High", ""],
  ["Confirm speakers", -45, "High", ""],
  ["Finalise event programme and run sheet", -14, "High", ""],
  ["Set up event registration", -35, "High", ""],
  ["Posters", -35, "High", ""],
  ["Launch event publicity", -28, "High", ""],
  ["Spread poster to academics ahead of event", -21, "Normal", ""],
  ["Review registrations and attendee numbers", -7, "Normal", ""],
  ["Confirm equipment and event materials", -7, "High", ""],
  ["Confirm committee attendance and event-day roles", -5, "High", "President"],
  ["Complete final event checks", -3, "Urgent", ""],
  ["Send final attendee reminder", -2, "Normal", "Secretary"],
  ["Event-day setup and attendee check-in", 0, "Urgent", ""],
  ["Deliver event-day run sheet responsibilities", 0, "Urgent", ""],
  ["Send follow-up and thank-you messages", 2, "Normal", "Secretary"],
  ["Record attendance and event outcomes", 3, "Normal", "Secretary"],
  ["Hold event debrief", 7, "Normal", "President"],
];

const utcToday = (clock = new Date()) =>
  new Date(clock).toISOString().slice(0, 10);
const localToday = (clock = new Date()) => {
  const d = new Date(clock);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatDate = (date) =>
  date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Date TBC";
const bucket = (row, clock = new Date()) =>
  row.status === "Cancelled"
    ? "cancelled"
    : row.status === "Completed"
      ? "past"
      : row.date && row.date < localToday(clock)
        ? "past"
        : "upcoming";
const eventBucket = bucket,
  meetingBucket = bucket;
const overdue = (t, clock = new Date()) =>
  t.status !== "Complete" && !!t.due_date && t.due_date < utcToday(clock);
function offsetDate(date, offset) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(offset))
    throw new Error("A valid event date and integer offset are required");
  const d = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== date)
    throw new Error("Invalid date");
  d.setUTCDate(d.getUTCDate() + offset);
  return utcToday(d);
}
function readiness(d) {
  const checks = [!!d.event.date, !!d.event.lead_organiser_id];
  if (d.event.funding_required !== "No")
    checks.push(d.funding.some((f) => ["Confirmed", "N/A"].includes(f.status)));
  if (d.event.room_required !== "No")
    checks.push(
      !!d.venue &&
        ["Confirmed", "Not required"].includes(d.venue.booking_status),
    );
  const speakers = d.speakers.filter(
    (s) => !["Declined", "Withdrawn"].includes(s.invitation_status),
  );
  if (speakers.length)
    checks.push(speakers.every((s) => s.invitation_status === "Confirmed"));
  checks.push(
    ...d.checklist
      .filter((c) => c.status !== "Not applicable")
      .map((c) => c.status === "Complete"),
  );
  return Math.round((100 * checks.filter(Boolean).length) / checks.length);
}
function getDetail(t, id) {
  const event = t.events.find((e) => e.event_id === id);
  if (!event) throw new Error("This event does not exist or has been deleted.");
  const linked = (rows) => rows.filter((r) => r.event_id === id);
  return {
    event,
    speakers: linked(t.event_speakers).map((l) => ({
      ...t.speakers.find((s) => s.speaker_id === l.speaker_id),
      ...l,
    })),
    posters: linked(t.posters),
    tasks: linked(t.tasks),
    funding: linked(t.funding),
    venue: linked(t.venues)[0] || null,
    organisations: linked(t.event_organisations).map((l) => ({
      ...t.organisations.find((o) => o.organisation_id === l.organisation_id),
      ...l,
    })),
    attendance: linked(t.attendance),
    checklist: linked(t.checklist),
  };
}
function summary(t, e) {
  const d = getDetail(t, e.event_id),
    sp = d.speakers.filter(
      (s) => !["Declined", "Withdrawn"].includes(s.invitation_status),
    );
  return {
    ...e,
    progress: readiness(d),
    funding_status:
      ["Confirmed", "Pending", "No", "N/A"].find((s) =>
        d.funding.some((f) => f.status === s),
      ) || (e.funding_required === "No" ? "N/A" : "Not started"),
    room_status:
      d.venue?.booking_status ||
      (e.room_required === "No" ? "Not required" : "Not started"),
    speaker_summary: `${sp.filter((s) => s.invitation_status === "Confirmed").length}/${sp.length}`,
    committee_confirmed: d.attendance.filter(
      (a) => a.attendance_status === "Confirmed attending",
    ).length,
    lead_organiser_name:
      t.committee.find((m) => m.member_id === e.lead_organiser_id)?.name ||
      "Unassigned",
    organisation_ids: d.organisations.map((o) => o.organisation_id),
  };
}
function generatedTasks(e, templates, members, existing = []) {
  return templates
    .filter(
      (t) =>
        t.active &&
        !existing.some(
          (x) => x.task_id === `task_auto_${e.event_id}_${t.template_id}`,
        ),
    )
    .map((t) => ({
      task_id: `task_auto_${e.event_id}_${t.template_id}`,
      event_id: e.event_id,
      task_name: t.task_name,
      description: t.description,
      assignee_member_id: members.some(
        (m) => m.member_id === t.assignee_member_id && m.active,
      )
        ? t.assignee_member_id
        : "",
      due_date: offsetDate(e.date, t.offset_days),
      priority: t.priority,
      status: "Not started",
      notes: "",
      generated_from_template_id: t.template_id,
      due_date_offset_days: t.offset_days,
      created_at: e.created_at,
      updated_at: e.updated_at,
    }));
}
const dateSort = (a, b) =>
  (a.date || a.due_date || "9999").localeCompare(
    b.date || b.due_date || "9999",
  ) || (a.start_time || "").localeCompare(b.start_time || "");
function safeUrl(value) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function same(a, b) {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => same(v, b[i]))
    );
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) =>
    same(a[k], b[k]),
  );
}
const conflict = () => {
  throw new Error(
    "Save conflict: another edit changed the same field or removed an edited record. Your changes are retained. Reload before resolving it.",
  );
};
function mergeRow(base, user, latest) {
  const result = { ...latest };
  for (const key of new Set([...Object.keys(base), ...Object.keys(user)])) {
    if (["created_at", "updated_at"].includes(key)) continue;
    const b = base[key],
      u = user[key],
      l = latest[key];
    if (!same(b, u)) {
      if (!same(b, l) && !same(u, l)) conflict();
      result[key] = u;
    }
  }
  return result;
}
function mergeRows(base, user, latest, key) {
  const out = [];
  for (const l of latest) {
    const b = base.find((x) => x[key] === l[key]),
      u = user.find((x) => x[key] === l[key]);
    if (!b) {
      if (u && !same(u, l)) conflict();
      out.push(l);
    } else if (u) out.push(mergeRow(b, u, l));
    else if (!same(b, l)) conflict();
  }
  for (const u of user) {
    if (latest.some((x) => x[key] === u[key])) continue;
    const b = base.find((x) => x[key] === u[key]);
    if (b) {
      if (!same(b, u)) conflict();
    } else out.push(u);
  }
  return out;
}

const SCHEMA = {
  events: {
    name: "Events",
    headers: [
      "event_id",
      "event_name",
      "description",
      "event_type",
      "date",
      "start_time",
      "end_time",
      "status",
      "lead_organiser_id",
      "funding_required",
      "room_required",
      "registration_link",
      "registration_numbers",
      "registration_capacity",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  speakers: {
    name: "Speakers",
    headers: [
      "speaker_id",
      "name",
      "organisation_name",
      "title",
      "email",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  event_speakers: {
    name: "Event_Speakers",
    headers: [
      "event_speaker_id",
      "event_id",
      "speaker_id",
      "invitation_status",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  posters: {
    name: "Event_Posters",
    headers: [
      "poster_id",
      "event_id",
      "title",
      "drive_url",
      "status",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  tasks: {
    name: "Event_Tasks",
    headers: [
      "task_id",
      "event_id",
      "task_name",
      "description",
      "assignee_member_id",
      "due_date",
      "priority",
      "status",
      "notes",
      "generated_from_template_id",
      "due_date_offset_days",
      "created_at",
      "updated_at",
    ],
  },
  task_templates: {
    name: "Task_Templates",
    headers: [
      "template_id",
      "task_name",
      "description",
      "assignee_member_id",
      "offset_days",
      "priority",
      "active",
      "created_at",
      "updated_at",
    ],
  },
  meetings: {
    name: "Meetings",
    headers: [
      "meeting_id",
      "meeting_name",
      "meeting_type",
      "date",
      "start_time",
      "end_time",
      "location",
      "meeting_link",
      "meeting_notes_link",
      "meeting_notes_file_id",
      "meeting_notes_file_name",
      "meeting_notes_file_url",
      "organiser_member_id",
      "organisation_id",
      "external_organisation",
      "status",
      "attendees",
      "agenda",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  committee: {
    name: "Committee",
    headers: [
      "member_id",
      "name",
      "role",
      "organisation_id",
      "email",
      "active",
      "created_at",
      "updated_at",
    ],
  },
  attendance: {
    name: "Event_Attendance",
    headers: [
      "attendance_id",
      "event_id",
      "member_id",
      "attendance_status",
      "event_role",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  organisations: {
    name: "Organisations",
    headers: [
      "organisation_id",
      "organisation_name",
      "acronym",
      "contact_name",
      "contact_email",
      "notes",
      "active",
      "created_at",
      "updated_at",
    ],
  },
  event_organisations: {
    name: "Event_Organisations",
    headers: [
      "event_organisation_id",
      "event_id",
      "organisation_id",
      "relationship_type",
      "created_at",
      "updated_at",
    ],
  },
  funding: {
    name: "Funding",
    headers: [
      "funding_id",
      "event_id",
      "organisation_id",
      "source_name",
      "status",
      "amount_requested",
      "amount_confirmed",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  venues: {
    name: "Venues",
    headers: [
      "venue_id",
      "event_id",
      "venue",
      "room",
      "booking_status",
      "capacity",
      "address",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
  checklist: {
    name: "Event_Checklist",
    headers: [
      "checklist_id",
      "event_id",
      "item_type",
      "item_name",
      "status",
      "notes",
      "created_at",
      "updated_at",
    ],
  },
};
function spreadsheet() {
  const sid =
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!sid) throw new Error("Run setupSpreadsheet first");
  return SpreadsheetApp.openById(sid);
}
function setupSpreadsheet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("Run from a script bound to your new Sheet");
    PropertiesService.getScriptProperties().setProperty(
      "SPREADSHEET_ID",
      ss.getId(),
    );
    Object.keys(SCHEMA).forEach((key) => {
      const def = SCHEMA[key],
        sheet = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
      const current = sheet.getLastColumn()
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : [];
      const headers = current.concat(
        def.headers.filter((h) => !current.includes(h)),
      );
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    });
    const prop = PropertiesService.getScriptProperties();
    if (!prop.getProperty("TEMPLATES_SEEDED")) {
      const t = readTables(),
        now = new Date().toISOString();
      templateSeeds.forEach((s, i) =>
        t.task_templates.push({
          template_id: "template_" + i,
          task_name: s[0],
          description: "Prepare and review " + s[0].toLowerCase() + ".",
          offset_days: s[1],
          priority: s[2],
          active: i !== 1,
          assignee_member_id: "",
          created_at: now,
          updated_at: now,
        }),
      );
      writeTables(t);
      prop.setProperty("TEMPLATES_SEEDED", "1");
    }
  } finally {
    lock.releaseLock();
  }
}
function normalizeCell(k, v) {
  if (v instanceof Date)
    return /_at$/.test(k)
      ? v.toISOString()
      : /time$/.test(k)
        ? Utilities.formatDate(v, "UTC", "HH:mm")
        : Utilities.formatDate(v, "UTC", "yyyy-MM-dd");
  if (k === "active") return v === true || String(v).toLowerCase() === "true";
  if (
    [
      "registration_numbers",
      "registration_capacity",
      "capacity",
      "amount_requested",
      "amount_confirmed",
      "offset_days",
      "due_date_offset_days",
    ].includes(k)
  )
    return v === "" ? undefined : Number(v);
  return String(v === null ? "" : v);
}
function readTables() {
  const ss = spreadsheet(),
    t = {};
  Object.keys(SCHEMA).forEach((key) => {
    const sheet = ss.getSheetByName(SCHEMA[key].name);
    if (!sheet) throw new Error("Missing schema. Run setupSpreadsheet.");
    const values = sheet.getDataRange().getValues(),
      headers = values.shift();
    t[key] = values
      .filter((r) => r[0] !== "")
      .map((row) =>
        Object.fromEntries(
          headers.map((k, i) => [k, normalizeCell(k, row[i])]),
        ),
      );
  });
  return t;
}
function writeTables(t) {
  const ss = spreadsheet();
  Object.keys(SCHEMA).forEach((key) => {
    const sheet = ss.getSheetByName(SCHEMA[key].name),
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0],
      rows = t[key].map((r) =>
        headers.map((h) => (r[h] === undefined ? "" : r[h])),
      );
    if (sheet.getLastRow() > 1)
      sheet
        .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
        .clearContent();
    if (rows.length)
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  });
  SpreadsheetApp.flush();
}
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function doGet(e) {
  try {
    const a = e.parameter.action;
    if (a === "health") return json({ ok: true, data: { ok: true } });
    const t = readTables();
    if (a === "bootstrap")
      return json({
        ok: true,
        data: {
          events: t.events.map((e) => summary(t, e)),
          committee: t.committee,
          organisations: t.organisations,
          meetings: t.meetings,
          tasks: t.tasks,
          task_templates: t.task_templates,
        },
      });
    if (a === "event")
      return json({ ok: true, data: getDetail(t, e.parameter.event_id) });
    throw new Error("Unsupported read action");
  } catch (err) {
    return json({ ok: false, error: err.message });
  }
}
function validateRecord(r, t) {
  for (const k of [
    "event_name",
    "task_name",
    "meeting_name",
    "organisation_name",
    "name",
  ])
    if (
      k in r &&
      !(
        k === "organisation_name" &&
        (!("organisation_id" in r) || "event_organisation_id" in r)
      ) &&
      !String(r[k] || "").trim()
    )
      throw new Error("A name is required");
  for (const k of [
    "registration_numbers",
    "registration_capacity",
    "capacity",
    "amount_requested",
    "amount_confirmed",
    "offset_days",
    "due_date_offset_days",
  ])
    if (r[k] !== undefined && r[k] !== "") {
      const n = r[k];
      if (
        typeof n !== "number" ||
        !isFinite(n) ||
        (!["amount_requested", "amount_confirmed"].includes(k) &&
          !Number.isInteger(n)) ||
        (!k.includes("offset") && n < 0) ||
        (k.includes("offset") && Math.abs(n) > 3650)
      )
        throw new Error("Invalid amount, count, capacity or timing offset");
    }
  Object.keys(r).forEach((k) => {
    if (
      (k.endsWith("_link") || k === "drive_url") &&
      r[k] &&
      !/^https?:\/\//i.test(r[k])
    )
      throw new Error("Links require HTTP(S)");
    if ((k === "date" || k === "due_date") && r[k]) offsetDate(r[k], 0);
  });
  [
    ["lead_organiser_id", "committee", "member_id"],
    ["assignee_member_id", "committee", "member_id"],
    ["organiser_member_id", "committee", "member_id"],
    ["member_id", "committee", "member_id"],
    ["organisation_id", "organisations", "organisation_id"],
    ["event_id", "events", "event_id"],
  ].forEach(([key, table, pk]) => {
    if (
      r[key] &&
      !(key === "event_id" && "event_name" in r) &&
      !(key === "member_id" && "name" in r) &&
      !(
        key === "organisation_id" &&
        "organisation_name" in r &&
        !("event_organisation_id" in r)
      ) &&
      !t[table].some((x) => x[pk] === r[key])
    )
      throw new Error("Invalid linked record: " + key);
  });
}
function upsert(t, table, r) {
  validateRecord(r, t);
  const key = SCHEMA[table].headers[0],
    old = t[table].find((x) => x[key] === r[key]);
  if (old) {
    r.created_at = old.created_at;
    r.updated_at = old.updated_at;
    if (!same(r, old)) r.updated_at = new Date().toISOString();
    t[table][t[table].indexOf(old)] = r;
  } else {
    r.created_at = new Date().toISOString();
    r.updated_at = r.created_at;
    t[table].push(r);
  }
  return r;
}
function mergeDetail(t, p) {
  const latest = getDetail(t, p.event.event_id),
    base = p.base_detail;
  if (!base) throw new Error("A base detail is required");
  const event = mergeRow(base.event, p.event, latest.event);
  upsert(t, "events", event);
  [
    ["funding", "funding", "funding_id"],
    ["posters", "posters", "poster_id"],
    ["attendance", "attendance", "attendance_id"],
    ["checklist", "checklist", "checklist_id"],
    ["organisations", "event_organisations", "event_organisation_id"],
    ["speakers", "event_speakers", "event_speaker_id"],
  ].forEach(([field, table, key]) => {
    let submitted = p[field];
    if (field === "speakers")
      submitted = submitted.filter((s) => String(s.name || "").trim());
    if (field === "posters")
      submitted = submitted.filter((s) => s.title || s.drive_url);
    if (field === "organisations")
      submitted = submitted.filter((s) => s.organisation_id);
    const merged = mergeRows(base[field], submitted, latest[field], key),
      old = t[table];
    t[table] = old.filter((x) => x.event_id !== event.event_id);
    merged.forEach((r) => {
      validateRecord(r, t);
      if (field === "speakers")
        upsert(t, "speakers", {
          speaker_id: r.speaker_id,
          name: r.name,
          organisation_name: r.organisation_name,
          title: r.title,
          email: r.email,
          notes: r.speaker_notes || "",
          created_at: r.created_at,
          updated_at: r.updated_at,
        });
      const record = Object.fromEntries(
        SCHEMA[table].headers.map((h) => [h, r[h]]),
      );
      const previous = old.find((x) => x[key] === r[key]);
      record.created_at = previous
        ? previous.created_at
        : new Date().toISOString();
      record.updated_at =
        previous && same(record, previous)
          ? previous.updated_at
          : new Date().toISOString();
      t[table].push(record);
    });
  });
  const venues = mergeRows(
    base.venue ? [base.venue] : [],
    p.venue ? [p.venue] : [],
    latest.venue ? [latest.venue] : [],
    "venue_id",
  );
  t.venues = t.venues.filter((v) => v.event_id !== event.event_id);
  venues.forEach((v) => upsert(t, "venues", v));
  if (
    p.update_automated_task_deadlines &&
    event.date &&
    event.date !== latest.event.date
  )
    t.tasks.forEach((task) => {
      if (
        task.event_id === event.event_id &&
        task.status !== "Complete" &&
        task.generated_from_template_id
      ) {
        task.due_date = offsetDate(event.date, task.due_date_offset_days || 0);
        task.updated_at = new Date().toISOString();
      }
    });
  return getDetail(t, event.event_id);
}
function uploadNotes(file, old) {
  const ext = file.name.split(".").pop().toLowerCase(),
    types = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  if (types[ext] !== file.type)
    throw new Error("Choose PDF/DOC/DOCX with matching MIME");
  const bytes = Utilities.base64Decode(file.base64);
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw new Error("File must be nonempty and <=8 MiB");
  const props = PropertiesService.getScriptProperties();
  let folder;
  const fid = props.getProperty("NOTES_FOLDER_ID");
  if (fid) folder = DriveApp.getFolderById(fid);
  else {
    const found = DriveApp.getFoldersByName("YEN Event Manager Meeting Notes");
    folder = found.hasNext()
      ? found.next()
      : DriveApp.createFolder("YEN Event Manager Meeting Notes");
    props.setProperty("NOTES_FOLDER_ID", folder.getId());
  }
  const uploaded = folder.createFile(
    Utilities.newBlob(bytes, file.type, file.name),
  );
  if (old && old.meeting_notes_file_id)
    DriveApp.getFileById(old.meeting_notes_file_id).setTrashed(true);
  return {
    meeting_notes_file_id: uploaded.getId(),
    meeting_notes_file_name: uploaded.getName(),
    meeting_notes_file_url: uploaded.getUrl(),
  };
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const p = JSON.parse(e.postData.contents),
      action = p.action || e.parameter.action;
    lock.waitLock(20000);
    const t = readTables();
    let data = null;
    const mappings = {
      saveEvent: ["events", "event"],
      saveCommittee: ["committee", "member"],
      saveOrganisation: ["organisations", "organisation"],
      saveTask: ["tasks", "task"],
      saveTaskTemplate: ["task_templates", "template"],
    };
    if (mappings[action]) {
      const [table, wrapper] = mappings[action];
      if (table === "task_templates" && p[wrapper].offset_days === undefined)
        throw new Error("Timing offset required");
      data = upsert(t, table, p[wrapper]);
    } else if (action === "createEventWithAutomation") {
      offsetDate(p.event.date, 0);
      data =
        t.events.find((x) => x.event_id === p.event.event_id) ||
        upsert(t, "events", p.event);
      t.tasks.push(
        ...generatedTasks(data, t.task_templates, t.committee, t.tasks),
      );
    } else if (action === "saveEventDetail") data = mergeDetail(t, p);
    else if (action === "saveMeeting") {
      const old = t.meetings.find((m) => m.meeting_id === p.meeting.meeting_id);
      validateRecord(p.meeting, t);
      let attachment = p.notes_file
        ? uploadNotes(p.notes_file, old)
        : old
          ? {
              meeting_notes_file_id: old.meeting_notes_file_id,
              meeting_notes_file_name: old.meeting_notes_file_name,
              meeting_notes_file_url: old.meeting_notes_file_url,
            }
          : {};
      data = upsert(t, "meetings", Object.assign(p.meeting, attachment));
    } else if (action === "deleteEvent") {
      const key = p.event_id,
        sp = t.event_speakers
          .filter((x) => x.event_id === key)
          .map((x) => x.speaker_id);
      t.events = t.events.filter((x) => x.event_id !== key);
      [
        "event_speakers",
        "posters",
        "tasks",
        "attendance",
        "event_organisations",
        "funding",
        "venues",
        "checklist",
      ].forEach(
        (table) => (t[table] = t[table].filter((x) => x.event_id !== key)),
      );
      t.speakers = t.speakers.filter(
        (s) =>
          !sp.includes(s.speaker_id) ||
          t.event_speakers.some((l) => l.speaker_id === s.speaker_id),
      );
    } else if (
      ["deleteTask", "deleteMeeting", "deleteTaskTemplate"].includes(action)
    ) {
      const table = {
          deleteTask: "tasks",
          deleteMeeting: "meetings",
          deleteTaskTemplate: "task_templates",
        }[action],
        key = SCHEMA[table].headers[0];
      t[table] = t[table].filter((x) => x[key] !== p[key]);
    } else throw new Error("Unsupported mutation action");
    writeTables(t);
    return json({ ok: true, data });
  } catch (err) {
    return json({ ok: false, error: err.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
