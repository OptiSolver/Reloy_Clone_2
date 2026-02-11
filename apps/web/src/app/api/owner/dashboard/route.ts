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

type KpiRow = {
  total_customers: number;
  total_events: number;
  total_staff: number;

  // nuevos
  visits: number;
  redeems: number;

  new_customers: number;
  recurrent_customers: number;

  at_risk_customers: number;
  lost_customers: number;
};

function parseRange(searchParams: URLSearchParams) {
  const raw = (searchParams.get("range") || "7d").toLowerCase();
  const now = new Date();

  const end = now; // hasta "ahora"

  if (raw === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { range: "today", start, end };
  }

  if (raw === "30d") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    return { range: "30d", start, end };
  }

  // default 7d
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  return { range: "7d", start, end };
}

function parseBranch(searchParams: URLSearchParams): string | null {
  const b = searchParams.get("branch");
  if (!b) return null;
  if (b === "all") return null;
  return isUuid(b) ? b : null;
}

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
  const { range, start, end } = parseRange(url.searchParams);
  const branchId = parseBranch(url.searchParams);

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
      return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });
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

      visits: 0,
      redeems: 0,

      new_customers: 0,
      recurrent_customers: 0,

      at_risk_customers: 0,
      lost_customers: 0,
    };

    if (merchantIds.length > 0) {
      // riesgo/perdido (config simple por ahora)
      const RISK_DAYS = 14;
      const LOST_DAYS = 30;

      // IMPORTANT:
      // - total_events se filtra por período (start/end) para que el selector impacte
      // - visits = eventos NO redeem (es el proxy "check-ins/actividad")
      // - redeems = type='redeem'
      //
      // - new_customers: customer cuyo primer evento EVER cae en el período
      // - recurrent_customers: customer con >=2 visits en el período
      // - at_risk/lost: según último evento (independiente del período; es "salud" real)
      const kpiRes = await client.query<KpiRow>(
        `
        with
        scope_merchants as (
          select unnest($1::uuid[]) as merchant_id
        ),
        scoped_events as (
          select e.*
          from events e
          join scope_merchants sm on sm.merchant_id = e.merchant_id
          where ($4::uuid is null or e.branch_id = $4::uuid)
        ),
        period_events as (
          select *
          from scoped_events
          where created_at >= $2::timestamptz
            and created_at <  $3::timestamptz
        ),
        customers_base as (
          select distinct m.customer_id
          from memberships m
          join scope_merchants sm on sm.merchant_id = m.merchant_id
        ),
        first_event_per_customer as (
          select customer_id, min(created_at) as first_at
          from scoped_events
          group by customer_id
        ),
        last_event_per_customer as (
          select customer_id, max(created_at) as last_at
          from scoped_events
          group by customer_id
        ),
        period_visits_per_customer as (
          select customer_id, count(*) as visit_count
          from period_events
          where type <> 'redeem'
          group by customer_id
        )
        select
          /* customers */
          (select count(*) from customers_base) as total_customers,

          /* total events in period */
          (select count(*) from period_events) as total_events,

          /* staff */
          (
            select count(*)
            from staff s
            join branches b on b.id = s.branch_id
            join scope_merchants sm on sm.merchant_id = b.merchant_id
            where ($4::uuid is null or b.id = $4::uuid)
          ) as total_staff,

          /* visits & redeems in period */
          (select count(*) from period_events where type <> 'redeem') as visits,
          (select count(*) from period_events where type = 'redeem') as redeems,

          /* new customers: first ever event in period */
          (
            select count(*)
            from first_event_per_customer f
            where f.first_at >= $2::timestamptz
              and f.first_at <  $3::timestamptz
          ) as new_customers,

          /* recurrent customers: >=2 visits in period */
          (
            select count(*)
            from period_visits_per_customer v
            where v.visit_count >= 2
          ) as recurrent_customers,

          /* at risk: last event between now-30d and now-14d */
          (
            select count(*)
            from last_event_per_customer l
            where l.last_at < (now() - ($5::int || ' days')::interval)
              and l.last_at >= (now() - ($6::int || ' days')::interval)
          ) as at_risk_customers,

          /* lost: last event older than 30d */
          (
            select count(*)
            from last_event_per_customer l
            where l.last_at < (now() - ($6::int || ' days')::interval)
          ) as lost_customers
        `,
        [merchantIds, start.toISOString(), end.toISOString(), branchId, RISK_DAYS, LOST_DAYS]
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
      filters: {
        range,
        start: start.toISOString(),
        end: end.toISOString(),
        branch_id: branchId ?? "all",
      },
      kpis,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}