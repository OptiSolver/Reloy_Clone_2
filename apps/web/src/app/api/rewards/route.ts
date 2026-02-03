export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";
import { CreateRewardInputSchema, createReward } from "@loop/core";

/**
 * GET /api/rewards?merchant_id=...
 * Lista rewards por merchant
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const merchant_id = url.searchParams.get("merchant_id");

    if (!merchant_id) {
      return NextResponse.json(
        { ok: false, error: "merchant_id es requerido" },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT *
      FROM rewards
      WHERE merchant_id = $1
      ORDER BY created_at DESC
      `,
      [merchant_id]
    );

    return NextResponse.json({
      ok: true,
      rewards: result.rows,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/rewards
 * Crea reward (MVP)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // contrato (camelCase)
    const parsed = CreateRewardInputSchema.parse(body);

    const inserted = await createReward(parsed);

    return NextResponse.json({ ok: true, reward: inserted });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
