import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
test("all routes, mobile menu, calendar overflow and no page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("+", { exact: true })).toHaveCount(0);
  await expect(page.locator("summary").first()).toBeVisible();
  for (const name of [
    "Events",
    "Meetings",
    "Tasks",
    "Committee",
    "Organisations",
    "Settings",
    "Dashboard",
  ]) {
    if (await page.getByRole("button", { name: "Menu" }).isVisible())
      await page.getByRole("button", { name: "Menu" }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true, level: 1 }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("name-only creation, child save/reload, independent task, Excel and cascade", async ({
  page,
}) => {
  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "+ Add Event", exact: true }).click();
  await page
    .getByLabel("Event name", { exact: false })
    .fill("Browser test event");
  await page.getByRole("button", { name: "Create event", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test event", exact: true }),
  ).toBeVisible();
  const url = page.url();
  await page.getByLabel("Description", { exact: true }).fill("Unsaved parent");
  await page.getByRole("button", { name: "+ Add task", exact: true }).click();
  await page.getByLabel("Task name").fill("Independent task");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Unsaved parent",
  );
  await page.getByRole("button", { name: "+ Add funding source" }).click();
  await page.getByLabel("Source", { exact: true }).fill("Synthetic funding");
  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(
    page.getByText("No unsaved changes", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Source", { exact: true })).toHaveValue(
    "Synthetic funding",
  );
  await expect(
    page.getByText("Independent task", { exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Excel" }).click();
  const file = await download,
    w = new ExcelJS.Workbook();
  await w.xlsx.readFile((await file.path())!);
  expect(w.worksheets.map((s) => s.name)).toEqual([
    "Event",
    "Speakers",
    "Tasks",
    "Funding",
    "Posters",
    "Venue",
    "Organisations",
    "Attendance",
    "Checklist",
  ]);
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Permanently delete event" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test event" }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Permanently delete event" }).click();
  await expect(
    page.getByRole("heading", { name: "Events", exact: true }),
  ).toBeVisible();
  await page.goto(url);
  await expect(page.getByRole("alert")).toContainText("deleted");
});
test("automation preview, generation, task status regroup and template deletion", async ({
  page,
}) => {
  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "+ Add Event" }).click();
  await page.getByLabel("Event name").fill("Automated browser event");
  await page.getByLabel("Create preparation tasks automatically").check();
  await expect(
    page.getByText("Choose an event date to preview the task deadlines."),
  ).toBeVisible();
  await page.getByLabel("Date", { exact: true }).fill("2026-12-01");
  await expect(page.getByText("18 preparation tasks")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(
    page.getByText("Agree event plan and approval", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Status for Agree event plan and approval")
    .selectOption("Complete");
  await expect(
    page.getByLabel("Status for Agree event plan and approval"),
  ).toHaveValue("Complete");
  await page.goto("/#/settings");
  await page
    .locator("tr")
    .filter({ hasText: "Agree event plan and approval" })
    .getByRole("button", { name: "Deactivate", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .locator("tr")
    .filter({ hasText: "Agree event plan and approval" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText("Agree event plan and approval", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/tasks");
  await expect(
    page.getByText("Agree event plan and approval", { exact: true }),
  ).toBeVisible();
});
test("meeting upload and replacement persist across reload", async ({
  page,
}) => {
  await page.goto("/#/meetings");
  await page.getByRole("button", { name: "+ Add meeting" }).click();
  await page.getByLabel("Meeting title").fill("Notes upload test");
  await page.getByLabel("Upload meeting notes file").setInputFiles({
    name: "notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF demo"),
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  const row = page.locator("tr").filter({ hasText: "Notes upload test" });
  await expect(row.getByText("notes.pdf (local demo upload)")).toBeVisible();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Upload meeting notes file").setInputFiles({
    name: "replacement.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF replacement"),
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    row.getByText("replacement.pdf (local demo upload)"),
  ).toBeVisible();
});
test("filters AND within bucket and cancellation does not create records", async ({
  page,
}) => {
  await page.goto("/#/events");
  await page.getByPlaceholder("Search event name").fill("Future");
  await page.getByLabel("Status", { exact: true }).selectOption("Confirmed");
  await expect(
    page.getByText("No matching events", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "past", exact: true }).click();
  await expect(page.getByText("Annual review", { exact: true })).toBeVisible();
  await expect(page.getByText("Ideas workshop", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "cancelled", exact: true }).click();
  await expect(
    page.getByText("Cancelled seminar", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ Add Event" }).click();
  await page.getByLabel("Event name").fill("Should not save");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Should not save")).toHaveCount(0);
});

test("dirty navigation retains edits on decline, and inactivation preserves history", async ({
  page,
}) => {
  await page.goto("/#/event/event_0");
  await page.getByLabel("Description", { exact: true }).fill("Keep my draft");
  if (await page.getByRole("button", { name: "Menu" }).isVisible())
    await page.getByRole("button", { name: "Menu" }).click();
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Committee", exact: true })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Keep my draft",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Committee", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Committee", exact: true }),
  ).toBeVisible();
  await page
    .locator("tr")
    .filter({ hasText: "Alex Morgan" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Status", { exact: true })
    .selectOption("false");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/#/event/event_0");
  await expect(page.getByLabel("Lead organiser")).toHaveValue("member_0");
  await expect(
    page.locator("#attendance").getByText("Alex Morgan"),
  ).toBeVisible();
});
test("date recalculation decline and accept preserve complete and manual tasks", async ({
  page,
}) => {
  await page.goto("/#/dashboard");
  await page.getByRole("button", { name: "+ Add Event" }).click();
  await page.getByLabel("Event name").fill("Deadline test");
  await page.getByLabel("Date", { exact: true }).fill("2026-12-01");
  await page.getByLabel("Create preparation tasks automatically").check();
  await page.getByRole("button", { name: "Create event" }).click();
  const first = page
    .locator("#tasks tr")
    .filter({ hasText: "Agree event plan and approval" });
  await first
    .getByLabel("Status for Agree event plan and approval")
    .selectOption("Complete");
  await expect(
    first.getByLabel("Status for Agree event plan and approval"),
  ).toHaveValue("Complete");
  await page.getByLabel("Date", { exact: true }).fill("2026-12-10");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(
    page.getByText("No unsaved changes", { exact: true }),
  ).toBeVisible();
  const venue = page
    .locator("#tasks tr")
    .filter({ hasText: "Confirm venue and room booking" });
  await expect(venue).toContainText("2 Oct 2026");
  await page.getByLabel("Date", { exact: true }).fill("2026-12-11");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Save all changes" }).click();
  await expect(
    page.getByText("No unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(venue).toContainText("12 Oct 2026");
  await expect(first).toContainText("1 Nov 2026");
});
test("separate browser contexts retain separate demo records", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext(),
    p = await a.newPage(),
    q = await b.newPage();
  await p.goto("/#/dashboard");
  await p.getByRole("button", { name: "+ Add Event" }).click();
  await p.getByLabel("Event name").fill("Private browser fixture");
  await p.getByRole("button", { name: "Create event" }).click();
  await expect(
    p.getByRole("heading", { name: "Private browser fixture" }),
  ).toBeVisible();
  await p.reload();
  await expect(
    p.getByRole("heading", { name: "Private browser fixture" }),
  ).toBeVisible();
  await q.goto("/#/events");
  await expect(
    q.getByRole("heading", { name: "Events", exact: true }),
  ).toBeVisible();
  await expect(q.getByText("Private browser fixture")).toHaveCount(0);
  await a.close();
  await b.close();
});
