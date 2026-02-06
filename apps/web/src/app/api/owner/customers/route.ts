export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@loop/db";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

async function getDevAuthUserId(req: Request): Promise<string | null> {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (h && isUuid(h)) return h;

  const cookieStore = await cookies();
  const c = cookieStore.get("dev_auth_user_id")?.value ?? null;

  if (c && isUuid(c)) return c;

  return null;
}

function clampLimit(raw: string | null, def = 20, max = 200) {
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

type OwnerRow = { id: string; first_name: string | null; last_name: string | null };
type MerchantRow = { id: string; name: string };

type CustomerListRow = {
  customer_id: string;
  merchant_id: string;
  merchant_name: string;
  status: string;
  points_balance: number;
  identifier_type: string | null;
  identifier_value_raw: string | null;
  identifier_value_normalized: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
  branch_name: string | null;
};

export async function GET(req: Request) {
  const auth_user_id = await getDevAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "missing_dev_auth_user_id (en dev mandá header x-auth-user-id o cookie dev_auth_user_id)",
      },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const limit = clampLimit(url.searchParams.get("limit"), 20, 200);

  const client = await pool.connect();
  try {
    const ownerRes = await client.query<OwnerRow>(
      `
      select id, first_name, last_name
      from owners
      where auth_user_id = $1
      limit 1
      `,
      [auth_user_id]
    );

    const owner = ownerRes.rows[0] ?? null;
    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "owner_not_found" },
        { status: 404 }
      );
    }

    const merchantsRes = await client.query<MerchantRow>(
      `
      select id, name
      from merchants
      where owner_id = $1 and is_active = true
      order by name asc
      `,
      [owner.id]
    );
    const merchants = merchantsRes.rows ?? [];
    const defaultMerchantId = merchants[0]?.id ?? null;

    if (!defaultMerchantId) {
      return NextResponse.json({
        ok: true,
        owner: { id: owner.id, name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() },
        merchants: [],
        defaults: { merchant_id: null },
        count: 0,
        customers: [],
      });
    }

    const params: Array<string | number> = [defaultMerchantId, limit];
    let where = `m.merchant_id = $1`;

    if (q && q.trim().length > 0) {
      const raw = q.trim();
      const digits = raw.replace(/\D+/g, "");
      const search = digits.length >= 6 ? digits : raw.toLowerCase();

      params.push(`%${search}%`);
      where += ` AND EXISTS (
        SELECT 1
        FROM customer_identifiers ci2
        WHERE ci2.customer_id = m.customer_id
          AND ci2.value_normalized ILIKE $${params.length}
      )`;
    }

    const listSql = `
      SELECT
        m.customer_id,
        m.merchant_id,
        mer.name as merchant_name,
        m.status,
        m.points_balance,
        ci.type as identifier_type,
        ci.value_raw as identifier_value_raw,
        ci.value_normalized as identifier_value_normalized,
        le.type as last_event_type,
        le.occurred_at as last_event_at,
        b.name as branch_name
      FROM memberships m
      JOIN merchants mer on mer.id = m.merchant_id
      LEFT JOIN LATERAL (
        SELECT type, value_raw, value_normalized
        FROM customer_identifiers
        WHERE customer_id = m.customer_id
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) ci ON true
      LEFT JOIN LATERAL (
        SELECT type, occurred_at, branch_id
        FROM events
        WHERE merchant_id = m.merchant_id
          AND customer_id = m.customer_id
        ORDER BY occurred_at DESC
        LIMIT 1
      ) le ON true
      LEFT JOIN branches b on b.id = le.branch_id
      WHERE ${where}
      ORDER BY le.occurred_at DESC NULLS LAST, m.created_at DESC
      LIMIT $2
    `;

    const listRes = await client.query<CustomerListRow>(listSql, params);

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchants,
      defaults: { merchant_id: defaultMerchantId },
      count: listRes.rows.length,
      customers: listRes.rows ?? [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}