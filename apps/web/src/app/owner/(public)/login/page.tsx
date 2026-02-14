export const runtime = "nodejs";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import OwnerAuthClient from "./OwnerAuthClient";

/* =========================
   Types
========================= */
type AuthOk = { ok: true; auth_user_id: string };
type AuthFail = { ok: false; error: string };
type AuthResponse = AuthOk | AuthFail;

type CookieStoreCompat = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    opts?: { httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string }
  ): void;
};

/* =========================
   Cookies helper (compat sync/async)
========================= */
async function getCookieStore(): Promise<CookieStoreCompat> {
  const c = cookies() as unknown;
  return (c instanceof Promise ? await c : c) as CookieStoreCompat;
}

function isProdLike(): boolean {
  return process.env.NODE_ENV === "production";
}

/* =========================
   Guards
========================= */
function isAuthResponse(v: unknown): v is AuthResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (obj.ok === true) return typeof obj.auth_user_id === "string";
  if (obj.ok === false) return typeof obj.error === "string";
  return false;
}

/* =========================
   Server Actions
========================= */
async function doOwnerLogin(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) redirect("/owner/login?error=missing_fields");

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(`${base}/api/owner/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const parsed: unknown = await res.json().catch(() => null);

  if (!res.ok || !isAuthResponse(parsed) || parsed.ok === false) {
    const code = isAuthResponse(parsed) && parsed.ok === false ? parsed.error : "server_error";
    redirect(`/owner/login?error=${encodeURIComponent(code)}`);
  }

  const c = await getCookieStore();
  c.set("dev_auth_user_id", parsed.auth_user_id, {
    httpOnly: false, // dev only (luego lo hacemos real)
    sameSite: "lax",
    path: "/",
  });

  redirect("/owner/onboarding");
}

async function doOwnerRegister(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const passwordConfirm = String(formData.get("password_confirm") ?? "").trim();

  if (!email || !password || !passwordConfirm) redirect("/owner/login?error=missing_fields");
  if (password !== passwordConfirm) redirect("/owner/login?error=password_mismatch");

  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const res = await fetch(`${base}/api/owner/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const parsed: unknown = await res.json().catch(() => null);

  if (!res.ok || !isAuthResponse(parsed) || parsed.ok === false) {
    const code = isAuthResponse(parsed) && parsed.ok === false ? parsed.error : "server_error";
    redirect(`/owner/login?error=${encodeURIComponent(code)}`);
  }

  const c = await getCookieStore();
  c.set("dev_auth_user_id", parsed.auth_user_id, {
    httpOnly: false, // dev only
    sameSite: "lax",
    path: "/",
  });

  redirect("/owner/onboarding");
}

async function doDevLoginById(formData: FormData) {
  "use server";

  const id = String(formData.get("user_id") ?? "").trim();
  if (!id) redirect("/owner/login?error=missing_user_id");

  const c = await getCookieStore();
  c.set("dev_auth_user_id", id, {
    httpOnly: false, // dev only
    sameSite: "lax",
    path: "/",
  });

  redirect("/owner/onboarding");
}

/* =========================
   Page
========================= */
export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <OwnerAuthClient
      error={params?.error}
      isDev={!isProdLike()}
      doOwnerLogin={doOwnerLogin}
      doOwnerRegister={doOwnerRegister}
      doDevLoginById={doDevLoginById}
    />
  );
}