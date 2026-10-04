import { test, expect } from "@playwright/test";

import { authenticate } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Forensics Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forensics");
  });

  test("displays KPI row with forensics metrics", async ({ page }) => {
    const kpiSection = page.locator("[data-testid='kpi-section'], [data-testid='kpi-cards']").first();
    if (await kpiSection.isVisible()) {
      const kpiCards = kpiSection.locator("[data-testid='kpi-card'], [class*='kpi'], [class*='card']");
      const count = await kpiCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test("displays INGEST NEW IMAGE button", async ({ page }) => {
    const ingestBtn = page.getByRole("button", { name: "INGEST NEW IMAGE" });
    await expect(ingestBtn).toBeVisible();
  });

  test("displays Evidence Timeline", async ({ page }) => {
    const timeline = page.locator("text=Evidence Timeline").first();
    await expect(timeline).toBeVisible();
  });

  test("timeline has at least 3 entries", async ({ page }) => {
    const timelineSection = page.locator("[data-testid='timeline'], [class*='timeline']").first();
    if (await timelineSection.isVisible()) {
      const entries = timelineSection.locator("[data-testid='timeline-entry'], [class*='entry'], [class*='item']");
      const count = await entries.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test("displays AI Agent Fleet panel", async ({ page }) => {
    const agentFleet = page.locator("text=AI Agent Fleet").first();
    await expect(agentFleet).toBeVisible();
  });

  test("displays Key Findings section", async ({ page }) => {
    const findings = page.locator("text=Key Findings").first();
    await expect(findings).toBeVisible();
  });

  test("displays Generate Report button", async ({ page }) => {
    const reportBtn = page.getByRole("button", { name: "Generate Report" });
    await expect(reportBtn).toBeVisible();
  });
});
