import { tableSchema } from "./schema";
import { seed } from "./seed";
import { statuses } from "../domain/statuses";
import type { Tables } from "../domain/types";
import { safeUrl, offsetDate } from "../domain/rules";
export interface ImportResult {
  tables: Tables;
  warnings: string[];
  count: number;
}
const numeric = new Set([
  "registration_numbers",
  "registration_capacity",
  "capacity",
  "amount_requested",
  "amount_confirmed",
  "offset_days",
  "due_date_offset_days",
]);
export function normalizeWorkbookCell(key: string, value: unknown): unknown {
  if (value && typeof value === "object" && "text" in value)
    value = (value as { text: string }).text;
  if (value instanceof Date) {
    if (/_at$/.test(key)) return value.toISOString();
    if (/time$/.test(key)) return value.toISOString().slice(11, 16);
    return value.toISOString().slice(0, 10);
  }
  if (key === "active")
    return value === true || String(value).toLowerCase() === "true";
  if (numeric.has(key))
    return value === null || value === undefined || value === ""
      ? undefined
      : Number(value);
  return value === undefined || value === null ? "" : String(value);
}
export function importRows(
  sheets: Record<string, unknown[][]>,
  clock = new Date(),
): ImportResult {
  const tables = seed(),
    warnings: string[] = [];
  for (const [key, def] of Object.entries(tableSchema)) {
    const rows = sheets[def.name];
    if (!rows)
      throw new Error(
        `Missing worksheet: ${def.name}. Use the complete dashboard workbook.`,
      );
    const headers = rows[0]?.map(String) || [];
    for (const h of def.headers)
      if (!headers.includes(h))
        throw new Error(`${def.name}: missing column ${h}`);
    const seen = new Set<string>();
    for (const [index, values] of rows.slice(1).entries()) {
      if (values.every((v) => v === null || v === undefined || v === ""))
        continue;
      const row = Object.fromEntries(
        def.headers.map((h) => [
          h,
          normalizeWorkbookCell(h, values[headers.indexOf(h)]),
        ]),
      );
      const pk = def.headers[0];
      if (!row[pk] || seen.has(String(row[pk])))
        throw new Error(
          `${def.name}: missing or duplicate record ID at row ${index + 2}`,
        );
      seen.add(String(row[pk]));
      // The supplied legacy Meetings export inserted two blank cells before status.
      if (
        key === "meetings" &&
        !row.status &&
        statuses.meeting.includes(String(row.agenda)) &&
        row.created_at &&
        !Number.isFinite(Date.parse(String(row.created_at)))
      ) {
        row.status = row.agenda;
        row.attendees = row.notes;
        row.agenda = row.created_at;
        row.notes = row.updated_at;
        row.created_at = "";
        row.updated_at = "";
        warnings.push(
          `Meetings row ${index + 2}: repaired shifted status/agenda fields.`,
        );
      }
      for (const k of ["created_at", "updated_at"])
        if (!row[k] || !Number.isFinite(Date.parse(String(row[k])))) {
          row[k] = clock.toISOString();
          warnings.push(
            `${def.name} row ${index + 2}: ${k} was missing/invalid; assigned import time.`,
          );
        }
      for (const [k, v] of Object.entries(row)) {
        if (numeric.has(k) && v !== undefined) {
          if (
            typeof v !== "number" ||
            !Number.isFinite(v) ||
            (!k.includes("offset") && v < 0) ||
            (!["amount_requested", "amount_confirmed"].includes(k) &&
              !Number.isInteger(v)) ||
            (k.includes("offset") && Math.abs(v) > 3650)
          )
            throw new Error(`${def.name} row ${index + 2}: invalid ${k}`);
        }
        if ((k === "date" || k === "due_date") && v) offsetDate(String(v), 0);
        if (
          (k.endsWith("_link") ||
            k === "drive_url" ||
            k === "meeting_notes_file_url") &&
          v &&
          !safeUrl(String(v))
        )
          throw new Error(`${def.name} row ${index + 2}: invalid link`);
      }
      (tables[key as keyof Tables] as unknown as object[]).push(row);
    }
  }
  const ids = (table: keyof Tables, pk: string) =>
    new Set(
      (tables[table] as unknown as Record<string, unknown>[]).map((r) => r[pk]),
    );
  const refs: [string, keyof Tables, string][] = [
    ["event_id", "events", "event_id"],
    ["member_id", "committee", "member_id"],
    ["lead_organiser_id", "committee", "member_id"],
    ["assignee_member_id", "committee", "member_id"],
    ["organiser_member_id", "committee", "member_id"],
    ["organisation_id", "organisations", "organisation_id"],
    ["speaker_id", "speakers", "speaker_id"],
  ];
  for (const [key, rows] of Object.entries(tables))
    for (const row of rows as Record<string, unknown>[]) {
      for (const [field, target, pk] of refs) {
        if (key === target && field === pk) continue;
        if (row[field] && !ids(target, pk).has(row[field]))
          throw new Error(
            `${tableSchema[key as keyof Tables].name}: unresolved ${field}. No data has been replaced.`,
          );
      }
    }
  return {
    tables,
    warnings,
    count: Object.values(tables).reduce((n, rows) => n + rows.length, 0),
  };
}
export async function readWorkbook(file: File): Promise<ImportResult> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Workbook must be at most 20 MiB.");
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheets: Record<string, unknown[][]> = {};
  for (const sheet of workbook.worksheets) {
    sheets[sheet.name] = Array.from({ length: sheet.rowCount }, (_, i) => {
      const values = sheet.getRow(i + 1).values as unknown[];
      return Array.from(
        { length: sheet.columnCount },
        (_, j) => values[j + 1] ?? null,
      );
    });
  }
  return importRows(sheets);
}
