import type { EventDetail, Bootstrap } from "../domain/types";
import { utcToday, safeUrl } from "../domain/rules";
export async function eventWorkbook(
  d: EventDetail,
  b: Bootstrap,
  origin = window.location.origin,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "YEN Event Manager";
  const now = new Date();
  workbook.created = now;
  const event = {
    ...d.event,
    lead_organiser_name:
      b.committee.find((m) => m.member_id === d.event.lead_organiser_id)
        ?.name || "Unassigned",
    exported_at: now.toISOString(),
    event_url: `${origin}/#/event/${d.event.event_id}`,
    export_scope:
      "Saved records only. Linked documents are links, not embedded files.",
  };
  const sections: Record<string, object[]> = {
    Event: Object.entries(event).map(([field, value]) => ({ field, value })),
    Speakers: d.speakers,
    Tasks: d.tasks.map((t) => ({
      ...t,
      assignee_name:
        b.committee.find((m) => m.member_id === t.assignee_member_id)?.name ||
        "Unassigned",
    })),
    Funding: d.funding,
    Posters: d.posters,
    Venue: d.venue ? [d.venue] : [],
    Organisations: d.organisations,
    Attendance: d.attendance.map((a) => {
      const m = b.committee.find((m) => m.member_id === a.member_id);
      return {
        ...a,
        member_name: m?.name || "",
        committee_role: m?.role || "",
        email: m?.email || "",
      };
    }),
    Checklist: d.checklist,
  };
  const typed = (key: string, value: unknown): any => {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value))
        return new Date(value + "T00:00:00Z");
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value);
      if (/^\d\d:\d\d$/.test(value)) {
        const [h, m] = value.split(":").map(Number);
        return (h * 60 + m) / 1440;
      }
      if (
        (key.includes("url") || key.includes("link")) &&
        value &&
        safeUrl(value)
      )
        return { text: value, hyperlink: value };
    }
    return value;
  };
  for (const [name, rows] of Object.entries(sections)) {
    const sheet = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    sheet.getCell("A2").value = d.event.event_name + " – " + name;
    sheet.getCell("A2").font = {
      size: 16,
      bold: true,
      color: { argb: "FF12304A" },
    };
    const keys = rows.length
      ? [...new Set(rows.flatMap((r) => Object.keys(r)))]
      : ["message"];
    sheet.getRow(4).values = keys;
    sheet.getRow(4).height = 26;
    sheet.getRow(4).eachCell((c) => {
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF12304A" },
      };
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });
    for (const record of rows.length
      ? rows
      : [{ message: "No saved records in this section." }]) {
      const r = record as Record<string, unknown>;
      const row = sheet.addRow(
        keys.map((k) =>
          typed(name === "Event" && k === "value" ? String(r.field) : k, r[k]),
        ),
      );
      row.eachCell((cell, i) => {
        cell.alignment = { wrapText: true, vertical: "top" };
        if (cell.value instanceof Date)
          cell.numFmt = String(r.field || keys[i - 1]).includes("_at")
            ? "dd mmm yyyy hh:mm"
            : "dd mmm yyyy";
        if (
          typeof cell.value === "number" &&
          /^\d\d:\d\d$/.test(String(r[keys[i - 1]]))
        )
          cell.numFmt = "hh:mm";
      });
    }
    sheet.columns.forEach((c) => {
      c.width = name === "Event" ? 40 : 25;
    });
    if (rows.length && name !== "Event")
      sheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: keys.length },
      };
  }
  return workbook;
}
export async function downloadEvent(d: EventDetail, b: Bootstrap) {
  const workbook = await eventWorkbook(d, b),
    buffer = await workbook.xlsx.writeBuffer(),
    blob = new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `YEN-${d.event.event_name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100)}-${utcToday()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
