import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { fixtureSeed } from "../fixtures/seed";
import { tableSchema } from "../../src/data/schema";
test("empty installation imports a full workbook privately and retains it on reload", async ({
  page,
}) => {
  const workbook = new ExcelJS.Workbook(),
    tables = fixtureSeed();
  for (const [key, def] of Object.entries(tableSchema)) {
    const sheet = workbook.addWorksheet(def.name);
    sheet.addRow(Array.from(def.headers));
    for (const r of tables[key as keyof typeof tables] as unknown as Record<
      string,
      unknown
    >[])
      sheet.addRow(def.headers.map((h) => r[h] ?? null));
  }
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await page.goto("/#/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Future of local economies", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/settings");
  await page
    .getByLabel("Select dashboard workbook")
    .setInputFiles({
      name: "dashboard.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  await expect(
    page.getByText("records ready to import", { exact: false }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Replace records with workbook" })
    .click();
  await expect(
    page.getByText("Dashboard workbook imported successfully"),
  ).toBeVisible();
  await page.goto("/#/events");
  await expect(
    page.getByText("Future of local economies", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Future of local economies", { exact: true }),
  ).toBeVisible();
});
