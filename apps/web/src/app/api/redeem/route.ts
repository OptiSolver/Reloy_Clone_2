export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

type RewardRow = {
  id: string;
  merchant_id: string;
  points_cost: number;
  is_active: boolean;
};

type RedemptionRow = {
  id: string;
  merchant_id: string;
  reward_id: string;
  customer_id: string;
  staff_id: string | null;
  branch_id: string | null;
  points_spent: number;
  status: string;
  created_at: string;
};

type EventRow = {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  customer_id: string;
  staff_id: string | null;
  type: string;
  payload: unknown;
  occurred_at: string;
  created_at: string;
};

type StaffCtxRow = {
  staff_id: string;
  branch_id: string;
  merchant_id: string;
  is_active: boolean;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function getAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;
  if (!h) return null;
  return isUuid(h) ? h : null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

async function resolveStaffContext(
  auth_user_id: string
): Promise<StaffCtxRow | null> {
  const res = await pool.query<StaffCtxRow>(
    `
    select
      s.id as staff_id,
      s.branch_id as branch_id,
      b.merchant_id as merchant_id,
      s.is_active as is_active
    from staff s
    join branches b on b.id = s.branch_id
    where s.auth_user_id = $1
    order by s.created_at desc
    limit 1
    `,
    [auth_user_id]
  );

  return res.rows[0] ?? null;
}

/**
 * POST /api/redeem
 *
 * Body soportado:
 * - Full (camelCase): { merchantId, customerId, rewardId, branchId?, staffId?, demoRunId? }
 * - Full (snake_case): { merchant_id, customer_id, reward_id, branch_id?, staff_id?, demo_run_id? }
 *
 * ✅ Nuevo (HC.2):
 * - Si viene header "x-auth-user-id", podés mandar SOLO:
 *   { customerId, rewardId } (o snake_case)
 *   y resolvemos merchant/branch/staff desde DB (staff → branch → merchant).
 *
 * ✅ Nuevo (HC3.5):
 * - Si mandás demoRunId/demo_run_id, lo guardamos en events.payload y points_ledger.meta
 *   para poder resetear todo por demo_run_id.
 */
export async function POST(req: Request) {
  try {
    const bodyUnknown = (await req.json()) as unknown;
    const body = asRecord(bodyUnknown);

    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid_body" },
        { status: 400 }
      );
    }

    // Accept camelCase o snake_case
    const customerId =
      pickString(body, "customerId") ?? pickString(body, "customer_id");
    const rewardId =
      pickString(body, "rewardId") ?? pickString(body, "reward_id");
    let merchantId =
      pickString(body, "merchantId") ?? pickString(body, "merchant_id");
    let branchId =
      pickString(body, "branchId") ?? pickString(body, "branch_id");
    let staffId = pickString(body, "staffId") ?? pickString(body, "staff_id");

    // ✅ demo_run_id (opcional)
    const demoRunId =
      pickString(body, "demoRunId") ?? pickString(body, "demo_run_id");

    if (!isUuid(customerId)) {
      return NextResponse.json(
        { ok: false, error: "customerId_required_or_invalid" },
        { status: 400 }
      );
    }

    if (!isUuid(rewardId)) {
      return NextResponse.json(
        { ok: false, error: "rewardId_required_or_invalid" },
        { status: 400 }
      );
    }

    if (merchantId !== null && merchantId !== undefined && merchantId !== "") {
      if (!isUuid(merchantId)) {
        return NextResponse.json(
          { ok: false, error: "merchantId_invalid" },
          { status: 400 }
        );
      }
    } else {
      merchantId = null;
    }

    if (branchId !== null && branchId !== undefined && branchId !== "") {
      if (!isUuid(branchId)) {
        return NextResponse.json(
          { ok: false, error: "branchId_invalid" },
          { status: 400 }
        );
      }
    } else {
      branchId = null;
    }

    if (staffId !== null && staffId !== undefined && staffId !== "") {
      if (!isUuid(staffId)) {
        return NextResponse.json(
          { ok: false, error: "staffId_invalid" },
          { status: 400 }
        );
      }
    } else {
      staffId = null;
    }

    // =========================
    // Identidad real (staff) desde header
    // =========================
    const auth_user_id = getAuthUserId(req);

    if (auth_user_id && (!merchantId || !branchId || !staffId)) {
      const ctx = await resolveStaffContext(auth_user_id);

      if (!ctx) {
        return NextResponse.json(
          { ok: false, error: "staff_context_not_found" },
          { status: 401 }
        );
      }

      if (!ctx.is_active) {
        return NextResponse.json(
          { ok: false, error: "staff_inactive" },
          { status: 403 }
        );
      }

      merchantId = merchantId ?? ctx.merchant_id;
      branchId = branchId ?? ctx.branch_id;
      staffId = staffId ?? ctx.staff_id;
    }

    if (!merchantId) {
      return NextResponse.json(
        { ok: false, error: "merchantId_required" },
        { status: 400 }
      );
    }

    // 1) reward
    const rewardRes = await pool.query<RewardRow>(
      `
      SELECT id, merchant_id, points_cost, is_active
      FROM rewards
      WHERE id = $1 AND merchant_id = $2
      LIMIT 1
      `,
      [rewardId, merchantId]
    );

    const reward = rewardRes.rows[0];

    if (!reward) {
      return NextResponse.json(
        { ok: false, error: "reward_not_found" },
        { status: 404 }
      );
    }

    if (!reward.is_active) {
      return NextResponse.json(
        { ok: false, error: "reward_inactive" },
        { status: 400 }
      );
    }

    const required = Number(reward.points_cost);

    // 2) already redeemed? (antes del balance)
    const alreadyRes = await pool.query<{ one: number }>(
      `
      SELECT 1 as one
      FROM reward_redemptions
      WHERE merchant_id = $1
        AND customer_id = $2
        AND reward_id = $3
        AND status = 'approved'
      LIMIT 1
      `,
      [merchantId, customerId, rewardId]
    );

    if ((alreadyRes.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: "already_redeemed" },
        { status: 409 }
      );
    }

    // 3) balance (ledger)
    const balRes = await pool.query<{ balance: string }>(
      `
      SELECT COALESCE(SUM(delta_points), 0)::text AS balance
      FROM points_ledger
      WHERE merchant_id = $1 AND customer_id = $2
      `,
      [merchantId, customerId]
    );

    const balance = Number(balRes.rows[0]?.balance ?? 0);

    if (balance < required) {
      return NextResponse.json(
        { ok: false, error: "insufficient_points", balance, required },
        { status: 400 }
      );
    }

    // 4) TX
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 4.1) reward_redemptions (anti-duplicado con índice parcial)
      const redemptionRes = await client.query<RedemptionRow>(
        `
        INSERT INTO reward_redemptions (
          merchant_id,
          reward_id,
          customer_id,
          staff_id,
          branch_id,
          points_spent,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'approved')
        ON CONFLICT (merchant_id, customer_id, reward_id)
          WHERE status = 'approved'
        DO NOTHING
        RETURNING *
        `,
        [
          merchantId,
          rewardId,
          customerId,
          staffId ?? null,
          branchId ?? null,
          required,
        ]
      );

      const redemption = redemptionRes.rows[0];

      if (!redemption) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { ok: false, error: "already_redeemed" },
          { status: 409 }
        );
      }

      // 4.2) event redeem (incluye demo_run_id si vino)
      const eventPayload: Record<string, unknown> = {
        reward_id: rewardId,
        reward_redemption_id: redemption.id,
      };

      if (demoRunId) {
        eventPayload.demo_run_id = demoRunId;
      }

      const eventRes = await client.query<EventRow>(
        `
        INSERT INTO events (
          merchant_id,
          branch_id,
          customer_id,
          staff_id,
          type,
          payload
        )
        VALUES ($1, $2, $3, $4, 'redeem', $5::jsonb)
        RETURNING *
        `,
        [
          merchantId,
          branchId ?? null,
          customerId,
          staffId ?? null,
          JSON.stringify(eventPayload),
        ]
      );

      const event = eventRes.rows[0];
      const eventId = event.id;

      // 4.3) ledger negativo (idempotente por source_event_id)
      await client.query(
        `
        INSERT INTO points_ledger (
          merchant_id,
          customer_id,
          branch_id,
          staff_id,
          source_event_id,
          delta_points,
          reason,
          meta
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT (source_event_id) DO NOTHING
        `,
        [
          merchantId,
          customerId,
          branchId ?? null,
          staffId ?? null,
          eventId,
          -required,
          "redeem_reward",
          JSON.stringify(eventPayload),
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        ok: true,
        redemption,
        event,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}