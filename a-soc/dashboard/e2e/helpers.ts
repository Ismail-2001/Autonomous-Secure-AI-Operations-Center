import type { APIRequestContext, Page } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "http://localhost:9002";
const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "changeme";

export interface TokenPair {
  accessToken: string;
  refreshToken?: string;
}

export async function mintToken(request: APIRequestContext): Promise<TokenPair> {
  // 1. Attempt production login endpoint with credentials
  try {
    const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    });
    if (res.ok()) {
      const body = await res.json();
      return {
        accessToken: body.access_token as string,
        refreshToken: body.refresh_token as string,
      };
    }
  } catch {
    // Fallback to dev mint endpoint
  }

  // 2. Dev-only arbitrary mint fallback
  const res = await request.post(`${API_BASE}/api/v1/auth/token`, {
    data: { user_id: ADMIN_USER, role: "admin" },
  });
  if (!res.ok()) {
    throw new Error(`Authentication failed on both /auth/login and /auth/token: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return {
    accessToken: body.access_token as string,
    refreshToken: body.refresh_token as string,
  };
}

export async function authenticate(page: Page, request: APIRequestContext): Promise<void> {
  const tokens = await mintToken(request);
  await page.addInitScript(
    ({ access, refresh }) => {
      window.localStorage.setItem("asoc_token", access);
      if (refresh) {
        window.localStorage.setItem("asoc_refresh_token", refresh);
      }
    },
    { access: tokens.accessToken, refresh: tokens.refreshToken },
  );
}
