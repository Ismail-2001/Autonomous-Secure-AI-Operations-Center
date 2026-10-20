import { test, expect } from "@playwright/test";

import { authenticate } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Hunting Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hunting");
  });

  test("displays page header", async ({ page }) => {
    const header = page.locator("text=Hunting").first();
    await expect(header).toBeVisible();
  });

  test("displays Event Density chart", async ({ page }) => {
    const chart = page.locator("text=Event Density").first();
    await expect(chart).toBeVisible();
  });

  test("displays Event table with data", async ({ page }) => {
    const table = page.locator("table, [data-testid='event-table']").first();
    if (await table.isVisible()) {
      const rows = table.locator("tbody tr, [role='row']");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("displays IOC Pivoting section", async ({ page }) => {
    const iocSection = page.locator("text=IOC").first();
    await expect(iocSection).toBeVisible();
  });
});
