import { NextResponse } from "next/server";
import { pool } from "@loop/db";

export const runtime = "nodejs";

function getAuthUserId(req: Request): string | null {
  return req.headers.get("x-auth-user-id");
}

type RewardSeed = {
  title: string;
  description: string;
  points_cost: number;
};

const REWARD_DEFAULTS_BY_INDUSTRY: Record<string, RewardSeed[]> = {
  automotriz: [
    {
      title: "Lavado Premium -15%",
      description: "Descuento válido de lun a vie",
      points_cost: 500,
    },
    {
      title: "Lavado Interior Gratis",
      description: "Válido para 1 unidad. Sujeto a disponibilidad",
      points_cost: 800,
    },
    {
      title: "Detail Express -10%",
      description: "Descuento en pulido/encerado express",
      points_cost: 1200,
    },
    {
      title: "Aspirado Gratis",
      description: "1 aspirado interior (sin lavado)",
      points_cost: 300,
    },
  ],
};

type PgClient = {
  query: (
    text: string,
    params?: readonly (string | number)[]
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  release: () => void;
};

async function seedRewards(client: PgClient, merchant_id: string, industry: string) {
  const list = REWARD_DEFAULTS_BY_INDUSTRY[industry] ?? [];
  if (list.length === 0) return { inserted: 0, skipped: 0 };

  const params: (string | number)[] = [merchant_id];
  for (const r of list) params.push(r.title, r.description, r.points_cost);

  const valuesSql = list
    .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, true)`)
    .join(", ");

  const insertSql = `
    WITH incoming(merchant_id, title, description, points_cost, is_active) AS (
      VALUES ${valuesSql}
    )
    INSERT INTO rewards (merchant_id, title, description, points_cost, is_active)
    SELECT i.merchant_id, i.title, i.description, i.points_cost, i.is_active
    FROM incoming i
    WHERE NOT EXISTS (
      SELECT 1
      FROM rewards r
      WHERE r.merchant_id = i.merchant_id
        AND r.title = i.title
    )
    RETURNING id
  `;

  const ins = await client.query(insertSql, params);
  const inserted = ins.rowCount ?? 0;
  return { inserted, skipped: list.length - inserted };
}

export async function POST(req: Request) {
  const auth_user_id = getAuthUserId(req);
  if (!auth_user_id) {
    return NextResponse.json(
      { ok: false, error: "missing_auth_user_id" },
      { status: 401 }
    );
  }

  const client = (await pool.connect()) as unknown as PgClient;

  try {
    await client.query("BEGIN");

    const ownerRes = await client.query(
      `SELECT id FROM owners WHERE auth_user_id = $1 LIMIT 1`,
      [auth_user_id]
    );
    const owner = ownerRes.rows[0] as { id: string } | undefined;
    if (!owner) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });
    }

    const merchantRes = await client.query(
      `SELECT id FROM merchants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [owner.id]
    );
    const merchant = merchantRes.rows[0] as { id: string } | undefined;
    if (!merchant) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "merchant_not_found" }, { status: 400 });
    }

    const msRes = await client.query(
      `SELECT industry FROM merchant_settings WHERE merchant_id = $1 LIMIT 1`,
      [merchant.id]
    );
    const ms = msRes.rows[0] as { industry: string } | undefined;
    if (!ms?.industry) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "industry_not_set" }, { status: 400 });
    }

    const seed = await seedRewards(client, merchant.id, ms.industry);

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      completed: true,
      merchant_id: merchant.id,
      industry: ms.industry,
      seed,
    });
  } catch (err) {
    console.error("[onboarding.complete] error", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}