export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

type StaffRow = {
  id: string;
  branch_id: string;
  auth_user_id: string | null;
  is_active: boolean;
  created_at: string;
};

type BranchJoinRow = {
  staff_id: string;
  branch_id: string;
  merchant_id: string;
};

type OwnerRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  account_type: string | null;
  status: string | null;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/**
 * DEV AUTH:
 * - En dev, usamos header "x-auth-user-id" (uuid).
 * - En prod, esto debería ser JWT Supabase. (Lo dejamos para más adelante.)
 */
function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (!h) return null;
  return isUuid(h) ? h : null;
}

/**
 * GET /api/session
 * Devuelve identidad "runtime" para operar sin pasar ids en body.
 */
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
    // Seteamos contexto estilo Supabase para que policies/funciones futuras puedan usar auth.uid()
    // (Aunque hoy estés pegándole directo con service role / pooler)
    await client.query(
      `
      select
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true)
      `,
      [auth_user_id]
    );

    // 1) OWNER (si existe)
    let owner: OwnerRow | null = null;

    try {
      const ownerRes = await client.query<OwnerRow>(
        `
        select id, auth_user_id, first_name, last_name, account_type, status
        from owners
        where auth_user_id = $1
        limit 1
        `,
        [auth_user_id]
      );
      owner = ownerRes.rows?.[0] ?? null;
    } catch {
      owner = null;
    }

    // 2) STAFF (si existe) + merchant_id por branch join
    let staff: (StaffRow & { merchant_id: string | null }) | null = null;

    try {
      const staffRes = await client.query<StaffRow>(
        `
        select id, branch_id, auth_user_id, is_active, created_at
        from staff
        where auth_user_id = $1
        order by created_at desc
        limit 1
        `,
        [auth_user_id]
      );

      const s = staffRes.rows?.[0] ?? null;

      if (s) {
        const joinRes = await client.query<BranchJoinRow>(
          `
          select
            s.id as staff_id,
            s.branch_id,
            b.merchant_id
          from staff s
          join branches b on b.id = s.branch_id
          where s.id = $1
          limit 1
          `,
          [s.id]
        );

        const j = joinRes.rows?.[0] ?? null;

        staff = {
          ...s,
          merchant_id: j?.merchant_id ?? null,
        };
      }
    } catch {
      staff = null;
    }

    return NextResponse.json({
      ok: true,
      auth_user_id,
      owner,
      staff,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}