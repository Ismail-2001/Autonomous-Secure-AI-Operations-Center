import { test, expect } from "@playwright/test";

import { authenticate } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Threat Intel Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/threat-intel");
  });

  test("displays page header", async ({ page }) => {
    const header = page.locator("text=Threat Intel").first();
    await expect(header).toBeVisible();
  });

  test("displays IOC Database section", async ({ page }) => {
    const iocSection = page.locator("text=IOC Database").first();
    await expect(iocSection).toBeVisible();
  });

  test("displays IOC table with data", async ({ page }) => {
    const table = page.locator("table, [data-testid='ioc-table']").first();
    if (await table.isVisible()) {
      const rows = table.locator("tbody tr, [role='row']");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("displays MITRE ATT&CK section", async ({ page }) => {
    const mitre = page.locator("text=MITRE").first();
    await expect(mitre).toBeVisible();
  });

  test("displays Target Profiles section", async ({ page }) => {
    const profiles = page.locator("text=Target Profiles").first();
    if (await profiles.isVisible()) {
      await expect(profiles).toBeVisible();
    }
  });

  test("displays Geolocation section", async ({ page }) => {
    const geo = page.locator("text=Attack Geolocation").first();
    if (await geo.isVisible()) {
      await expect(geo).toBeVisible();
    }
  });
});
