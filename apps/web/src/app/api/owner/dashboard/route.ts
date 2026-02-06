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
type KpiRow = { total_customers: number; total_events: number; total_staff: number };

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

    let kpis: KpiRow = {
      total_customers: 0,
      total_events: 0,
      total_staff: 0,
    };

    if (merchantIds.length > 0) {
      const kpiRes = await client.query<KpiRow>(
        `
        select
          (select count(distinct customer_id)
           from memberships
           where merchant_id = any($1::uuid[])
          ) as total_customers,

          (select count(*)
           from events
           where merchant_id = any($1::uuid[])
          ) as total_events,

          (select count(*)
           from staff s
           join branches b on b.id = s.branch_id
           where b.merchant_id = any($1::uuid[])
          ) as total_staff
        `,
        [merchantIds]
      );

      kpis = kpiRes.rows[0] ?? kpis;
    }

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchants,
      kpis,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}