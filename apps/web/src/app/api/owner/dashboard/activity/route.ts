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

type OwnerRow = { id: string; first_name: string | null; last_name: string | null };
type MerchantRow = { id: string; name: string };

type RecentEventRow = {
  id: string;
  type: string;
  customer_id: string;
  branch_id: string | null;
  occurred_at: string;
  branch_name: string | null;
};

type RecentCustomerRow = {
  customer_id: string;
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
      where owner_id = $1
        and is_active = true
      order by name asc
      `,
      [owner.id]
    );

    const merchants = merchantsRes.rows ?? [];
    const merchantIds = merchants.map((m) => m.id);

    if (merchantIds.length === 0) {
      return NextResponse.json({
        ok: true,
        owner: { id: owner.id, name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim() },
        merchants: [],
        recent_events: [],
        recent_customers: [],
      });
    }

    const recentEventsRes = await client.query<RecentEventRow>(
      `
      select
        e.id,
        e.type,
        e.customer_id,
        e.branch_id,
        e.occurred_at,
        b.name as branch_name
      from events e
      left join branches b on b.id = e.branch_id
      where e.merchant_id = any($1::uuid[])
      order by e.occurred_at desc
      limit 10
      `,
      [merchantIds]
    );

    const recentCustomersRes = await client.query<RecentCustomerRow>(
      `
      select
        x.customer_id,
        x.type as last_event_type,
        x.occurred_at as last_event_at,
        b.name as branch_name
      from (
        select distinct on (e.customer_id)
          e.customer_id,
          e.type,
          e.occurred_at,
          e.branch_id
        from events e
        where e.merchant_id = any($1::uuid[])
        order by e.customer_id, e.occurred_at desc
      ) x
      left join branches b on b.id = x.branch_id
      order by x.occurred_at desc nulls last
      limit 10
      `,
      [merchantIds]
    );

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchants,
      recent_events: recentEventsRes.rows ?? [],
      recent_customers: recentCustomersRes.rows ?? [],
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}