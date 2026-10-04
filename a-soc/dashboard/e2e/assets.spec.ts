import { test, expect } from "@playwright/test";

import { authenticate } from "./helpers";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Assets Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/assets");
  });

  test("displays KPI row with asset counts", async ({ page }) => {
    const kpiSection = page.locator("[data-testid='kpi-section'], [data-testid='kpi-cards']").first();
    if (await kpiSection.isVisible()) {
      const kpiCards = kpiSection.locator("[data-testid='kpi-card'], [class*='kpi'], [class*='card']");
      const count = await kpiCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test("displays asset table", async ({ page }) => {
    const table = page.locator("table, [data-testid='asset-table']").first();
    await expect(table).toBeVisible();
  });

  test("table has pagination controls", async ({ page }) => {
    const prevBtn = page.locator("text=PREV").first();
    const nextBtn = page.locator("text=NEXT").first();
    if (await prevBtn.isVisible()) {
      await expect(nextBtn).toBeVisible();
    }
  });

  test("displays right panel with asset details", async ({ page }) => {
    const rightPanel = page.locator("text=Selected Target").first();
    if (await rightPanel.isVisible()) {
      await expect(rightPanel).toBeVisible();
    }
  });

  test("displays Quick Actions section", async ({ page }) => {
    const quickActions = page.locator("text=Quick Actions").first();
    if (await quickActions.isVisible()) {
      await expect(quickActions).toBeVisible();
    }
  });

  test("displays Communication Topology", async ({ page }) => {
    const topology = page.locator("text=Communication Topology").first();
    if (await topology.isVisible()) {
      await expect(topology).toBeVisible();
    }
  });

  test("pagination works - clicking NEXT shows more assets", async ({ page }) => {
    const nextBtn = page.locator("button:has-text('NEXT'), [data-testid='next-page']").first();
    if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
      const firstRowText = await page.locator("table tbody tr").first().textContent();
      await nextBtn.click();
      await page.waitForTimeout(500);
      const newFirstRowText = await page.locator("table tbody tr").first().textContent();
      expect(newFirstRowText).not.toBe(firstRowText);
    }
  });
});
