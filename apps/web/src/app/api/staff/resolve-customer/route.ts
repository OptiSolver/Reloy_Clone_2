export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (h && isUuid(h)) return h;

  // ✅ fallback para dev (sin obligar al front a mandar headers)
  const env = process.env.DEV_AUTH_USER_ID || null;
  if (env && isUuid(env)) return env;

  return null;
}

type StaffContext = { staff_id: string; branch_id: string; merchant_id: string };

async function getStaffContextByAuthUserId(auth_user_id: string): Promise<StaffContext | null> {
  const res = await pool.query<StaffContext>(
    `
    select
      s.id as staff_id,
      s.branch_id,
      b.merchant_id
    from staff s
    join branches b on b.id = s.branch_id
    where s.auth_user_id = $1
      and s.is_active = true
    order by s.created_at desc
    limit 1
    `,
    [auth_user_id]
  );

  return res.rows?.[0] ?? null;
}

export async function POST(req: Request) {
  const auth_user_id = getDevAuthUserId(req);
  if (!auth_user_id) {
    return NextResponse.json(
      { ok: false, error: "missing_dev_auth_user_id" },
      { status: 401 }
    );
  }

  const ctx = await getStaffContextByAuthUserId(auth_user_id);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "staff_not_found" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  // 🔎 Resolvemos customer por:
  // - phone (normalizado a dígitos) via customer_identifiers
  // - qr (value_normalized) via customer_identifiers
  const digits = token.replace(/\D+/g, "");
  const isPhone = digits.length >= 6;

  const sql = isPhone
    ? `
      select ci.customer_id
      from customer_identifiers ci
      join memberships m on m.customer_id = ci.customer_id
      where m.merchant_id = $1
        and ci.type = 'phone'
        and ci.value_normalized = $2
      order by ci.is_primary desc, ci.created_at asc
      limit 1
    `
    : `
      select ci.customer_id
      from customer_identifiers ci
      join memberships m on m.customer_id = ci.customer_id
      where m.merchant_id = $1
        and ci.type = 'qr'
        and ci.value_normalized = $2
      order by ci.is_primary desc, ci.created_at asc
      limit 1
    `;

  const valueNormalized = isPhone ? digits : token.toLowerCase();

  const r = await pool.query<{ customer_id: string }>(sql, [ctx.merchant_id, valueNormalized]);
  const row = r.rows?.[0] ?? null;

  if (!row) {
    return NextResponse.json({ ok: false, error: "customer_not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, customer_id: row.customer_id });
}