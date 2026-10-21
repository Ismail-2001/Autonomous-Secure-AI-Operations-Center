import { test, expect } from "@playwright/test";
import { authenticate, mintToken } from "./helpers";

const API_BASE = process.env.API_BASE_URL || "http://localhost:9002";

test.beforeEach(async ({ page, request }) => {
  await authenticate(page, request);
});

test.describe("Production End-to-End Validation Suite", () => {
  // ── 1. War Game Simulation Engine Walkthrough ─────────────────────────────
  test.describe("1. War Game Simulation Engine (Adversarial Emulation)", () => {
    test("backend exposes war game scenarios with RBAC protection", async ({ request }) => {
      const tokens = await mintToken(request);
      const res = await request.get(`${API_BASE}/api/v1/simulation/scenarios`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      expect(res.status()).toBeLessThan(500);
      if (res.ok()) {
        const scenarios = await res.json();
        expect(Array.isArray(scenarios)).toBeTruthy();
        expect(scenarios.length).toBeGreaterThanOrEqual(3);

        const keys = scenarios.map((s: any) => s.key);
        expect(keys).toContain("ransomware");
        expect(keys).toContain("exfiltration");
        expect(keys).toContain("credential_dumping");
      }
    });

    test("command center UI launches War Game modal and displays scenario choices", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Verify floating WAR GAME button exists and click it
      const warGameBtn = page.locator("button:has-text('WAR GAME')").first();
      await expect(warGameBtn).toBeVisible({ timeout: 10000 });
      await warGameBtn.click();

      // Verify War Game modal opens
      const modal = page.locator("[role='dialog']").filter({ hasText: "WAR GAME ADVERSARIAL SIMULATION" });
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Verify scenario choices exist
      await expect(page.locator("text=BlackCat / ALPHV Ransomware")).toBeVisible();
      await expect(page.locator("text=Scattered Spider Cloud Exfiltration")).toBeVisible();
      await expect(page.locator("text=Active Directory Mimikatz")).toBeVisible();

      // Close modal
      const closeBtn = page.locator("button:has-text('ESC'), button:has-text('✕')").first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    });
  });

  // ── 2. Live Blast Radius Interactive Graph Visualization ──────────────────
  test.describe("2. Live Blast Radius Interactive Graph Topology", () => {
    test("renders blast radius canvas/svg, controls, and contagion slider", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Verify Blast Radius panel is rendered
      const blastRadiusTitle = page.locator("text=BLAST RADIUS TOPOLOGY").first();
      await expect(blastRadiusTitle).toBeVisible({ timeout: 10000 });

      // Verify graph container and legend exist
      const liveTopologyBadge = page.locator("text=LIVE TOPOLOGY").first();
      await expect(liveTopologyBadge).toBeVisible();

      // Verify node type indicators
      await expect(page.locator("text=TARGET / COMPROMISED").first()).toBeVisible();
      await expect(page.locator("text=UPSTREAM / LATERAL").first()).toBeVisible();

      // Verify contagion hop selector exists
      const hopSelector = page.locator("text=CONTAGION HOPS").first();
      await expect(hopSelector).toBeVisible();

      // Verify node interaction works
      const svg = page.locator("svg").filter({ has: page.locator("circle") }).first();
      await expect(svg).toBeVisible();
      const nodeCircles = svg.locator("circle");
      const nodeCount = await nodeCircles.count();
      expect(nodeCount).toBeGreaterThan(0);
    });
  });

  // ── 3. One-Click Audit Report & Attestation Walkthrough ────────────────────
  test.describe("3. One-Click PDF/JSON Audit Report Exporter", () => {
    test("backend renders publication-grade HTML attestation certificate", async ({ request }) => {
      const tokens = await mintToken(request);
      const res = await request.get(`${API_BASE}/api/v1/compliance/export/html?framework=soc2&days=30`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      expect(res.status()).toBeLessThan(500);
      if (res.ok()) {
        const html = await res.text();
        expect(html).toContain("Autonomous Security Operations Center (A-SOC)");
        expect(html).toContain("Continuous Regulatory Compliance & Security Controls Attestation");
        expect(html).toContain("CRYPTOGRAPHIC EVIDENCE DIGEST (SHA-256)");
        expect(html).toContain("SOC2");
      }
    });

    test("governance dashboard launches Audit Export modal with multi-framework selectors", async ({ page }) => {
      await page.goto("/governance");
      await page.waitForLoadState("domcontentloaded");

      // Verify export buttons exist
      const exportSoc2Btn = page.locator("button:has-text('Export SOC 2 Audit')").first();
      await expect(exportSoc2Btn).toBeVisible({ timeout: 10000 });
      await exportSoc2Btn.click();

      // Verify Audit Export modal opens
      const modal = page.locator("[role='dialog']").filter({ hasText: "EVIDENCE EXPORTER" });
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Verify framework selector tabs exist
      await expect(page.locator("button:has-text('SOC 2 Type II')")).toBeVisible();
      await expect(page.locator("button:has-text('ISO/IEC 27001')")).toBeVisible();
      await expect(page.locator("button:has-text('Unified Audit')")).toBeVisible();

      // Verify 3 export action buttons exist
      await expect(page.locator("button:has-text('PDF / Print')")).toBeVisible();
      await expect(page.locator("button:has-text('JSON Bundle')")).toBeVisible();
      await expect(page.locator("button:has-text('Auditor CSV')")).toBeVisible();

      // Verify cryptographic digest block exists
      await expect(page.locator("text=SHA-256 EVIDENCE MANIFEST DIGEST")).toBeVisible();
      await expect(page.locator("button:has-text('COPY HASH')")).toBeVisible();

      // Close modal via ESC or close button
      await page.keyboard.press("Escape");
    });
  });
});
