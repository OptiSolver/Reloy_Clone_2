export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

function getAuthUserId(req: Request): string | null {
  return req.headers.get("x-auth-user-id");
}

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
};

type PgErrorShape = { message?: unknown; code?: unknown };
function errToJson(e: unknown) {
  const obj = (typeof e === "object" && e !== null ? (e as PgErrorShape) : {}) as PgErrorShape;
  const message = e instanceof Error ? e.message : typeof obj.message === "string" ? obj.message : String(e);
  const code = typeof obj.code === "string" ? obj.code : undefined;
  return { message, code };
}

export async function GET(req: Request) {
  const auth_user_id = getAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json({ ok: false, error: "missing_auth_user_id" }, { status: 401 });
  }

  const client = (await pool.connect()) as unknown as DbClient;

  try {
    const ownerRes = await client.query(
      `
      SELECT id, onboarding_step
      FROM owners
      WHERE auth_user_id = $1
      LIMIT 1
      `,
      [auth_user_id]
    );

    const owner = ownerRes.rows[0] as { id: string; onboarding_step: number } | undefined;

    if (!owner) {
      return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });
    }

    const step = Number.isFinite(owner.onboarding_step) ? owner.onboarding_step : 0;
    const is_complete = step >= 3;

    return NextResponse.json({
      ok: true,
      owner: { owner_id: owner.id },
      onboarding: { step, is_complete },
    });
  } catch (e) {
    console.error("[api/owner/onboarding/status] error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", debug: errToJson(e) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}