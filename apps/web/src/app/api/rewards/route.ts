export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db, eq, desc, rewards } from "@loop/db";

/**
 * GET /api/rewards?merchant_id=...
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const merchant_id = url.searchParams.get("merchant_id");

    if (!merchant_id) {
      return NextResponse.json(
        { ok: false, error: "merchant_id requerido" },
        { status: 400 }
      );
    }

    const list = await db
      .select()
      .from(rewards)
      .where(eq(rewards.merchantId, merchant_id))
      .orderBy(desc(rewards.pointsCost));

    return NextResponse.json({
      ok: true,
      rewards: list,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
