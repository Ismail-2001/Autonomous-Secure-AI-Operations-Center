import type { APIRequestContext, Page } from "@playwright/test";

const API_BASE = process.env.API_BASE_URL || "http://localhost:9002";

export async function mintToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/v1/auth/token`, {
    data: { user_id: "admin", role: "admin" },
  });
  if (!res.ok()) {
    throw new Error(`token mint failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.access_token as string;
}

export async function authenticate(page: Page, request: APIRequestContext): Promise<void> {
  const token = await mintToken(request);
  await page.addInitScript(
    (t) => {
      window.localStorage.setItem("asoc_token", t);
    },
    token,
  );
}
