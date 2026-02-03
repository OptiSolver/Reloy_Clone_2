import { pool } from "@loop/db";

export async function listRewards(params: {
  merchantId: string;
  onlyActive?: boolean;
  limit?: number;
}) {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

  const where: string[] = ["merchant_id = $1"];
  const values: Array<string | number> = [params.merchantId];

  if (params.onlyActive) {
    where.push("is_active = true");
  }

  values.push(limit);

  const sql = `
    SELECT *
    FROM rewards
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(sql, values);
  return result.rows;
}