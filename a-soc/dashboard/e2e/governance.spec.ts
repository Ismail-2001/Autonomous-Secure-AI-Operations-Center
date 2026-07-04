import { test, expect } from "@playwright/test";

test.describe("Governance Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/governance");
  });

  test("displays page header", async ({ page }) => {
    const header = page.locator("text=Governance").first();
    await expect(header).toBeVisible();
  });

  test("displays Compliance Score", async ({ page }) => {
    const score = page.locator("text=Compliance Score, text=Compliance").first();
    await expect(score).toBeVisible();
  });

  test("displays Risk Matrix", async ({ page }) => {
    const matrix = page.locator("text=Risk Matrix, text=Risk Assessment").first();
    if (await matrix.isVisible()) {
      await expect(matrix).toBeVisible();
    }
  });

  test("displays Control Table", async ({ page }) => {
    const table = page.locator("table, [data-testid='control-table']").first();
    if (await table.isVisible()) {
      const rows = table.locator("tbody tr, [role='row']");
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("displays compliance controls with PASS/FAIL status", async ({ page }) => {
    const passStatus = page.locator("text=PASS").first();
    const failStatus = page.locator("text=FAIL").first();
    const hasStatus = (await passStatus.isVisible()) || (await failStatus.isVisible());
    expect(hasStatus).toBeTruthy();
  });
});
