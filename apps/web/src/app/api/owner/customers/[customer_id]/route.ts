export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * DEV AUTH:
 * - En dev usamos header "x-auth-user-id" (uuid).
 */
function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (!h) return null;
  return isUuid(h) ? h : null;
}

type OwnerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type MerchantRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type MembershipRow = {
  id: string;
  merchant_id: string;
  customer_id: string;
  status: string;
  points_balance: number;
  created_at: string;
  updated_at: string;
};

type IdentifierRow = {
  id: string;
  type: string;
  value_raw: string;
  value_normalized: string;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

type LastEventRow = {
  id: string;
  type: string;
  occurred_at: string;
  branch_id: string | null;
  staff_id: string | null;
  payload: unknown;
  branch_name: string | null;
};

async function unwrapParams(
  params: Promise<{ customer_id: string }> | { customer_id: string }
): Promise<{ customer_id: string }> {
  const pUnknown: unknown = params;

  if (pUnknown && typeof pUnknown === "object") {
    const r = pUnknown as Record<string, unknown>;
    if (typeof r.then === "function") {
      return (params as Promise<{ customer_id: string }>);
    }
  }

  return params as { customer_id: string };
}

export async function GET(
  req: Request,
  context: { params: Promise<{ customer_id: string }> | { customer_id: string } }
) {
  const auth_user_id = getDevAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "missing_dev_auth_user_id (en dev mandá header x-auth-user-id: <uuid>)",
      },
      { status: 401 }
    );
  }

  const { customer_id } = await unwrapParams(context.params);

  if (!isUuid(customer_id)) {
    return NextResponse.json(
      { ok: false, error: "customer_id inválido" },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // 1) Owner por auth_user_id
    const ownerRes = await client.query<OwnerRow>(
      `
      select id, first_name, last_name
      from owners
      where auth_user_id = $1
      limit 1
      `,
      [auth_user_id]
    );

    const owner = ownerRes.rows?.[0] ?? null;

    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "owner_not_found_for_auth_user_id", auth_user_id },
        { status: 404 }
      );
    }

    // 2) Merchants del owner
    const merchantsRes = await client.query<MerchantRow>(
      `
      select id, name, is_active
      from merchants
      where owner_id = $1
      order by name asc
      `,
      [owner.id]
    );

    const merchants = merchantsRes.rows ?? [];
    const activeMerchants = merchants.filter((m) => m.is_active);
    const defaultMerchantId = activeMerchants[0]?.id ?? null;

    if (!defaultMerchantId) {
      return NextResponse.json(
        { ok: false, error: "owner_has_no_active_merchants" },
        { status: 400 }
      );
    }

    // 3) Membership (default merchant)
    const membershipRes = await client.query<MembershipRow>(
      `
      select id, merchant_id, customer_id, status, points_balance, created_at, updated_at
      from memberships
      where merchant_id = $1 and customer_id = $2
      limit 1
      `,
      [defaultMerchantId, customer_id]
    );

    const membership = membershipRes.rows?.[0] ?? null;

    if (!membership) {
      return NextResponse.json(
        { ok: false, error: "membership_not_found" },
        { status: 404 }
      );
    }

    // 4) Identifiers
    const identifiersRes = await client.query<IdentifierRow>(
      `
      select id, type, value_raw, value_normalized, is_primary, verified_at, created_at
      from customer_identifiers
      where customer_id = $1
      order by is_primary desc, created_at asc
      `,
      [customer_id]
    );

    // 5) Last event (+ branch name)
    const lastEventRes = await client.query<LastEventRow>(
      `
      select
        e.id,
        e.type,
        e.occurred_at,
        e.branch_id,
        e.staff_id,
        e.payload,
        b.name as branch_name
      from events e
      left join branches b on b.id = e.branch_id
      where e.merchant_id = $1 and e.customer_id = $2
      order by e.occurred_at desc
      limit 1
      `,
      [defaultMerchantId, customer_id]
    );

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchants: activeMerchants.map((m) => ({ id: m.id, name: m.name })),

      merchant_id: defaultMerchantId,
      customer_id,

      membership,
      identifiers: identifiersRes.rows ?? [],
      last_event: lastEventRes.rows?.[0] ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}