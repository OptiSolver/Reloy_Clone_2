export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";
import { RedeemInputSchema } from "@loop/core";

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

/**
 * POST /api/redeem
 * body: { merchantId, customerId, rewardId, branchId?, staffId? }
 *
 * Hace:
 * 1) valida reward + costo
 * 2) valida already_redeemed (antes del balance) -> mejor UX
 * 3) valida balance (points_ledger)
 * 4) TX:
 *    4.1) inserta reward_redemptions (anti-duplicado por índice parcial) -> already_redeemed
 *    4.2) inserta event 'redeem' (payload: reward_id + reward_redemption_id)
 *    4.3) inserta points_ledger delta negativo idempotente por source_event_id
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RedeemInputSchema.parse(body);

    const { merchantId, customerId, rewardId, branchId, staffId } = parsed;

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

    const balance = Number(balRes.rows?.[0]?.balance ?? 0);

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
      // Índice esperado:
      // CREATE UNIQUE INDEX reward_redemptions_one_active_per_reward
      // ON reward_redemptions (merchant_id, customer_id, reward_id)
      // WHERE status = 'approved';
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

      // 4.2) event redeem (guardamos reward_id + reward_redemption_id)
      const eventPayload = {
        reward_id: rewardId,
        reward_redemption_id: redemption.id,
      };

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
      // Índice esperado (parcial):
      // CREATE UNIQUE INDEX points_ledger_source_event_id_uq
      // ON points_ledger (source_event_id)
      // WHERE source_event_id IS NOT NULL;
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