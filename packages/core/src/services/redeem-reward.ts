import { pool } from "@loop/db";
import { RedeemInput } from "../contracts/redeem";

type PgError = { code?: string };

export async function redeemReward(input: RedeemInput) {
  const { merchantId, branchId, customerId, staffId, rewardId } = input;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) reward (points_cost)
    const rewardRes = await client.query(
      `
      SELECT id, merchant_id, points_cost, is_active
      FROM rewards
      WHERE id = $1 AND merchant_id = $2
      LIMIT 1
      `,
      [rewardId, merchantId]
    );

    const reward = rewardRes.rows[0] as
      | {
          id: string;
          merchant_id: string;
          points_cost: number;
          is_active: boolean;
        }
      | undefined;

    if (!reward) throw new Error("reward_not_found");
    if (!reward.is_active) throw new Error("reward_inactive");

    // 2) balance (MVP simple)
    const balRes = await client.query(
      `
      SELECT COALESCE(SUM(delta_points),0) AS balance
      FROM points_ledger
      WHERE merchant_id = $1 AND customer_id = $2
      `,
      [merchantId, customerId]
    );

    const balance = Number(balRes.rows?.[0]?.balance ?? 0);

    if (balance < reward.points_cost) {
      const err: any = new Error("insufficient_points");
      err.balance = balance;
      err.required = reward.points_cost;
      throw err;
    }

    // 3) redemption (puede fallar por unique index -> ya canjeado)
    let redemption: any;
    try {
      const redemptionRes = await client.query(
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
        RETURNING *
        `,
        [
          merchantId,
          rewardId,
          customerId,
          staffId ?? null,
          branchId ?? null,
          reward.points_cost,
        ]
      );

      redemption = redemptionRes.rows[0];
    } catch (e: unknown) {
      const pg = e as PgError;

      // 23505 = unique_violation
      if (pg?.code === "23505") {
        // devolvemos un error limpio (y opcionalmente info)
        throw new Error("already_redeemed");
      }

      throw e;
    }

    // 4) event redeem
    const eventRes = await client.query(
      `
      INSERT INTO events (
        merchant_id,
        branch_id,
        customer_id,
        staff_id,
        type,
        payload
      )
      VALUES ($1, $2, $3, $4, 'redeem', $5)
      RETURNING *
      `,
      [
        merchantId,
        branchId ?? null,
        customerId,
        staffId ?? null,
        { reward_id: rewardId },
      ]
    );

    const event = eventRes.rows[0] as { id: string };

    // 5) ledger (idempotente por source_event_id)
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (source_event_id) DO NOTHING
      `,
      [
        merchantId,
        customerId,
        branchId ?? null,
        staffId ?? null,
        event.id,
        -reward.points_cost,
        "redeem_reward",
        { reward_id: rewardId, redemption_id: redemption?.id ?? null },
      ]
    );

    await client.query("COMMIT");
    return { redemption, event };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}