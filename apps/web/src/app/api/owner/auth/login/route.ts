export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";
import crypto from "crypto";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, "hex");
  const iterations = 120_000;
  const keylen = 32;
  const digest = "sha256";
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return derived.toString("hex");
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type DbClient = {
  query: <T = unknown>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as LoginBody | null;

  const emailRaw = body?.email;
  const passwordRaw = body?.password;

  if (!isNonEmptyString(emailRaw) || !isNonEmptyString(passwordRaw)) {
    return NextResponse.json(
      { ok: false, error: "email_and_password_required" },
      { status: 400 }
    );
  }

  const email = normalizeEmail(emailRaw);
  const password = passwordRaw.trim();

  const client = (await pool.connect()) as unknown as DbClient;

  try {
    const q = await client.query<{
      id: string;
      password_hash: string;
      password_salt: string;
    }>(
      `
      select id, password_hash, password_salt
      from auth_users
      where lower(email) = lower($1)
      limit 1
      `,
      [email]
    );

    const row = q.rows[0];
    if (!row) {
      // no revelar si existe o no
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    const expectedHash = row.password_hash;
    const saltHex = row.password_salt;

    const computed = hashPassword(password, saltHex);
    const ok = timingSafeEqualHex(computed, expectedHash);

    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "invalid_credentials" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, auth_user_id: row.id });
  } catch (e) {
    console.error("[owner/auth/login] error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    // @ts-expect-error pool client release
    client.release?.();
  }
}