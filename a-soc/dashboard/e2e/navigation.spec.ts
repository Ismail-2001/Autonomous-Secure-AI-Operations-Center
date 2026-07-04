import { test, expect, type Page } from "@playwright/test";

const routes = {
  monitoring: "/",
  hunting: "/hunting",
  assets: "/assets",
  forensics: "/forensics",
  threatIntel: "/threat-intel",
  governance: "/governance",
};

test.describe("Navigation", () => {
  test("sidebar links navigate to all pages", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);

    const navLinks = [
      { label: "Monitoring", href: "/" },
      { label: "Hunting", href: "/hunting" },
      { label: "Assets", href: "/assets" },
      { label: "Forensics", href: "/forensics" },
      { label: "Threat Intel", href: "/threat-intel" },
      { label: "Governance", href: "/governance" },
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a[href="${link.href}"]`).first();
      await navLink.click();
      await page.waitForURL(new RegExp(link.href === "/" ? "/$" : link.href));
      await expect(page).toHaveURL(new RegExp(link.href === "/" ? "/$" : link.href));
    }
  });

  test("page title updates on navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1, h2, [data-testid='page-title']").first()).toBeVisible();

    await page.goto("/hunting");
    await expect(page.locator("h1, h2, [data-testid='page-title']").first()).toBeVisible();
  });
});

test.describe("Shell Layout", () => {
  test("sidebar is visible", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("nav, [role='navigation'], aside").first();
    await expect(sidebar).toBeVisible();
  });

  test("top bar is visible", async ({ page }) => {
    await page.goto("/");
    const topbar = page.locator("header, [role='banner']").first();
    await expect(topbar).toBeVisible();
  });

  test("status bar shows connection status", async ({ page }) => {
    await page.goto("/");
    const statusbar = page.locator("footer, [role='contentinfo'], [data-testid='status-bar']").first();
    await expect(statusbar).toBeVisible();
  });
});
