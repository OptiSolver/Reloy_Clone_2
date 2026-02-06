export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

/**
 * DEV AUTH:
 * En dev usamos header x-auth-user-id
 */
function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (!h) return null;

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(h);

  return isUuid ? h : null;
}

type OwnerRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type MerchantRow = {
  id: string;
  name: string;
};

type RewardRow = {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  points_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CreateBody = {
  merchant_id?: string; // opcional (si no viene, usamos default)
  title: string;
  description?: string;
  points_cost: number;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function GET(req: Request) {
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

  const client = await pool.connect();
  try {
    // 1) Owner
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
      select id, name
      from merchants
      where owner_id = $1
        and is_active = true
      order by name asc
      `,
      [owner.id]
    );

    const merchants = merchantsRes.rows ?? [];
    const default_merchant_id = merchants[0]?.id ?? null;

    if (!default_merchant_id) {
      return NextResponse.json({
        ok: true,
        owner: {
          id: owner.id,
          name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
        },
        merchants,
        defaults: { merchant_id: null },
        count: 0,
        rewards: [],
      });
    }

    // 3) Rewards del merchant default
    const rewardsRes = await client.query<RewardRow>(
      `
      select id, merchant_id, title, description, points_cost, is_active, created_at, updated_at
      from rewards
      where merchant_id = $1
      order by created_at desc
      `,
      [default_merchant_id]
    );

    const rewards = rewardsRes.rows ?? [];

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchants,
      defaults: { merchant_id: default_merchant_id },
      count: rewards.length,
      rewards,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
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

  const client = await pool.connect();
  try {
    const body = (await req.json()) as Partial<CreateBody>;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
    }

    if (typeof body.title !== "string" || body.title.trim() === "") {
      return NextResponse.json({ ok: false, error: "title requerido" }, { status: 400 });
    }

    const points = Number(body.points_cost);
    if (!Number.isFinite(points) || points <= 0) {
      return NextResponse.json(
        { ok: false, error: "points_cost inválido" },
        { status: 400 }
      );
    }

    // 1) Owner
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

    // 2) Merchants del owner (para validar que el merchant pertenezca)
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
    const default_merchant_id = merchants[0]?.id ?? null;

    const desiredMerchantId =
      isUuid(body.merchant_id) ? body.merchant_id : default_merchant_id;

    if (!desiredMerchantId) {
      return NextResponse.json(
        { ok: false, error: "owner_has_no_active_merchants" },
        { status: 400 }
      );
    }

    // Validación pertenencia
    if (!merchants.some((m) => m.id === desiredMerchantId)) {
      return NextResponse.json(
        { ok: false, error: "merchant_not_allowed_for_owner" },
        { status: 403 }
      );
    }

    // 3) Insert reward
    const ins = await client.query<RewardRow>(
      `
      insert into rewards (
        merchant_id, title, description, points_cost, is_active
      )
      values ($1,$2,$3,$4,true)
      returning id, merchant_id, title, description, points_cost, is_active, created_at, updated_at
      `,
      [desiredMerchantId, body.title.trim(), body.description?.trim() ?? null, points]
    );

    const reward = ins.rows?.[0] ?? null;

    return NextResponse.json({
      ok: true,
      owner: {
        id: owner.id,
        name: `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim(),
      },
      merchant_id: desiredMerchantId,
      reward,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}