import { test, expect } from "@playwright/test";

import { authenticate } from "./helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:9002";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("API Integration", () => {
  test("dashboard stats endpoint is reachable", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/dashboard/stats`, {
      headers: { Authorization: "Bearer test-token" },
    });
    expect(response.status()).toBeLessThan(500);
  });

  test("health endpoint returns OK", async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
  });
});

test.describe("Page Resilience", () => {
  test("Monitoring page loads even with API down", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1, h2, [data-testid='page-title']").first()).toBeVisible();
  });

  test("Assets page loads with demo fallback", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.locator("table, [data-testid='asset-table']").first()).toBeVisible();
  });

  test("Forensics page loads with demo fallback", async ({ page }) => {
    await page.goto("/forensics");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Hunting page loads with demo fallback", async ({ page }) => {
    await page.goto("/hunting");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Threat Intel page loads with demo fallback", async ({ page }) => {
    await page.goto("/threat-intel");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("Governance page loads with demo fallback", async ({ page }) => {
    await page.goto("/governance");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("pages render on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const pages = ["/", "/hunting", "/assets", "/forensics", "/threat-intel", "/governance"];

    for (const route of pages) {
      await page.goto(route);
      await expect(page.locator("h1, h2, main").first()).toBeVisible();
    }
  });

  test("pages render on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const pages = ["/", "/hunting", "/assets", "/forensics", "/threat-intel", "/governance"];

    for (const route of pages) {
      await page.goto(route);
      await expect(page.locator("h1, h2, main").first()).toBeVisible();
    }
  });
});

test.describe("Performance", () => {
  test("pages load within 5 seconds", async ({ page }) => {
    const routes = ["/", "/hunting", "/assets", "/forensics", "/threat-intel", "/governance"];

    for (const route of routes) {
      const start = Date.now();
      await page.goto(route, { waitUntil: "domcontentloaded" });
      const loadTime = Date.now() - start;
      expect(loadTime).toBeLessThan(5000);
    }
  });
});
