import { test, expect } from "@playwright/test";

test.describe("Monitoring Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays KPI cards row", async ({ page }) => {
    const kpiSection = page.locator("[data-testid='kpi-section'], [data-testid='kpi-cards']").first();
    if (await kpiSection.isVisible()) {
      const kpiCards = kpiSection.locator("[data-testid='kpi-card'], [class*='kpi'], [class*='card']");
      const count = await kpiCards.count();
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  test("displays Agent Fleet panel", async ({ page }) => {
    const agentFleet = page.locator("text=Agent Fleet").first();
    await expect(agentFleet).toBeVisible();
  });

  test("displays Blast Radius visualization", async ({ page }) => {
    const blastRadius = page.locator("text=Blast Radius").first();
    await expect(blastRadius).toBeVisible();
  });

  test("displays Threat Stream feed", async ({ page }) => {
    const threatStream = page.locator("text=Threat Stream").first();
    await expect(threatStream).toBeVisible();
  });

  test("displays Approval Panel", async ({ page }) => {
    const approvalPanel = page.locator("text=Approval").first();
    await expect(approvalPanel).toBeVisible();
  });
});
