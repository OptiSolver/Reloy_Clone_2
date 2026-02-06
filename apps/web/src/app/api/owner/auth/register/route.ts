export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";
import crypto from "crypto";

type RegisterBody = {
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
  // PBKDF2 (sin dependencias externas)
  const salt = Buffer.from(saltHex, "hex");
  const iterations = 120_000;
  const keylen = 32;
  const digest = "sha256";
  const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
  return derived.toString("hex");
}

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
};

async function ensureOwnerRow(client: DbClient, authUserId: string) {
// Crea owner si no existe. Requiere que owners.auth_user_id exista (ya lo tenés).
  await client.query(
    `
    insert into owners (auth_user_id, onboarding_step)
    values ($1, 0)
    on conflict (auth_user_id) do nothing
    `,
    [authUserId]
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RegisterBody | null;

  const emailRaw = body?.email;
  const passwordRaw = body?.password;

  if (!isNonEmptyString(emailRaw) || !isNonEmptyString(passwordRaw)) {
    return NextResponse.json({ ok: false, error: "email_and_password_required" }, { status: 400 });
  }

  const email = normalizeEmail(emailRaw);
  const password = passwordRaw.trim();

  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const existing = await client.query<{ id: string }>(
      `select id from auth_users where lower(email) = lower($1) limit 1`,
      [email]
    );

    if (existing.rows[0]) {
      return NextResponse.json({ ok: false, error: "email_already_registered" }, { status: 409 });
    }

    const saltHex = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, saltHex);

    const inserted = await client.query<{ id: string }>(
      `
      insert into auth_users (email, password_hash, password_salt)
      values ($1, $2, $3)
      returning id
      `,
      [email, passwordHash, saltHex]
    );

    const auth_user_id = inserted.rows[0]?.id;
    if (!auth_user_id) {
      return NextResponse.json({ ok: false, error: "register_failed" }, { status: 500 });
    }

    await ensureOwnerRow(client, auth_user_id);

    return NextResponse.json({ ok: true, auth_user_id });
  } catch (e) {
    console.error("[owner/auth/register] error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}