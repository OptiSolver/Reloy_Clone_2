import { pool } from "@loop/db";
import { CreateRewardInput } from "../contracts/reward";

/**
 * Crea un reward en DB.
 * Devuelve row raw (snake_case) tal como viene de Postgres.
 */
export async function createReward(input: CreateRewardInput) {
  const {
    merchantId,
    title,
    description,
    pointsCost,
    isActive,
    meta,
  } = input;

  const result = await pool.query(
    `
    INSERT INTO rewards (
      merchant_id,
      title,
      description,
      points_cost,
      is_active,
      meta
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      merchantId,
      title,
      description ?? null,
      pointsCost,
      isActive ?? true,
      meta ?? {},
    ]
  );

  return result.rows[0];
}
