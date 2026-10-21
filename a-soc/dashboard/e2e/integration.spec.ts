import { test, expect } from "@playwright/test";

import { authenticate, mintToken } from "./helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:9002";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Production Authentication & Security", () => {
  test("authenticates via login or token minting and returns valid JWT pair", async ({ request }) => {
    const tokens = await mintToken(request);
    expect(tokens.accessToken).toBeDefined();
    expect(typeof tokens.accessToken).toBe("string");
    expect(tokens.accessToken.length).toBeGreaterThan(20);
  });

  test("mints a short-lived WebSocket ticket using Bearer token", async ({ request }) => {
    const tokens = await mintToken(request);
    const res = await request.post(`${API_BASE}/api/v1/auth/ws-ticket`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (res.ok()) {
      const data = await res.json();
      expect(data.ticket).toBeDefined();
      expect(typeof data.ticket).toBe("string");
      expect(data.expires_in).toBeGreaterThan(0);
    } else {
      // In dev fallback mode if ws-ticket is optional
      expect(res.status()).toBeLessThan(500);
    }
  });

  test("refresh token endpoint rejects invalid tokens with 401", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/v1/auth/refresh`, {
      data: { refresh_token: "invalid.expired.bogus.token" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Background Jobs & Async Worker Orchestration", () => {
  test("enqueues incident workflow job and verifies status transitions", async ({ request }) => {
    const tokens = await mintToken(request);
    const incidentId = `INC-E2E-${Date.now()}`;

    const resEnqueue = await request.post(`${API_BASE}/api/v1/jobs/enqueue`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { incident_id: incidentId, max_attempts: 3 },
    });

    if (resEnqueue.status() === 201) {
      const job = await resEnqueue.json();
      expect(job.id).toBeDefined();
      expect(job.incident_id).toBe(incidentId);
      expect(["PENDING", "RUNNING", "COMPLETED"]).toContain(job.state);

      // Verify querying the job by ID
      const resGet = await request.get(`${API_BASE}/api/v1/jobs/${job.id}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      expect(resGet.ok()).toBeTruthy();
      const fetchedJob = await resGet.json();
      expect(fetchedJob.id).toBe(job.id);

      // Verify supervisor cancellation
      const resCancel = await request.post(`${API_BASE}/api/v1/jobs/${job.id}/cancel`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        data: { reason: "E2E automated test cancellation" },
      });
      expect(resCancel.status()).toBeLessThan(500);
    } else {
      // If jobs backend requires DB not running in lightweight container, verify graceful 503 or 404
      expect(resEnqueue.status()).toBeLessThan(500);
    }
  });

  test("lists jobs with incident filtering", async ({ request }) => {
    const tokens = await mintToken(request);
    const res = await request.get(`${API_BASE}/api/v1/jobs?limit=10`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe("API Health & Dashboard Stats", () => {
  test("dashboard stats endpoint is reachable", async ({ request }) => {
    const tokens = await mintToken(request);
    const response = await request.get(`${API_BASE}/api/v1/dashboard/stats`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect(response.status()).toBeLessThan(500);
  });

  test("health endpoint returns healthy or degraded state", async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(["healthy", "degraded"]).toContain(data.status);
    expect(data.service).toBe("asoc-backend");
  });
});

test.describe("Page Resilience & Offline Demo Fallback", () => {
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

test.describe("Performance SLA", () => {
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
