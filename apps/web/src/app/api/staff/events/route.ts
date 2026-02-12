export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";
import { CreateEventInputSchema, createEvent } from "@loop/core";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (h && isUuid(h)) return h;

  const env = process.env.DEV_AUTH_USER_ID || null;
  if (env && isUuid(env)) return env;

  return null;
}

type StaffContext = {
  staff_id: string;
  branch_id: string;
  merchant_id: string;
};

async function getStaffContextByAuthUserId(
  auth_user_id: string
): Promise<StaffContext | null> {
  const res = await pool.query<StaffContext>(
    `
    select
      s.id as staff_id,
      s.branch_id,
      b.merchant_id
    from staff s
    join branches b on b.id = s.branch_id
    where s.auth_user_id = $1
      and s.is_active = true
    order by s.created_at desc
    limit 1
    `,
    [auth_user_id]
  );

  return res.rows?.[0] ?? null;
}

/**
 * Si createEvent no exporta tipo, inferimos el retorno.
 * Esto elimina el "any" y te deja el tipo real si TS puede inferirlo.
 */
type CreateEventResult = Awaited<ReturnType<typeof createEvent>>;

/**
 * Fallback seguro: necesitamos al menos un id.
 * Si tu retorno no incluye id, ahí sí hay que alinear el core.
 */
function getEventId(result: CreateEventResult): string | null {
  return "id" in (result as object) &&
    typeof (result as { id?: unknown }).id === "string"
    ? (result as { id: string }).id
    : null;
}

export async function POST(req: Request) {
  const auth_user_id = getDevAuthUserId(req);
  if (!auth_user_id) {
    return NextResponse.json(
      { ok: false, error: "missing_dev_auth_user_id" },
      { status: 401 }
    );
  }

  const ctx = await getStaffContextByAuthUserId(auth_user_id);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "staff_not_found" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  // Esperamos: { customer_id, type, payload }
  const parsed = CreateEventInputSchema.safeParse({
    merchant_id: ctx.merchant_id,
    branch_id: ctx.branch_id,
    staff_id: ctx.staff_id,
    customer_id: body?.customer_id,
    type: body?.type,
    payload: body?.payload ?? {},
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const inserted = await createEvent(parsed.data);
    const event_id = getEventId(inserted);

    return NextResponse.json({ ok: true, event_id }, { status: 201 });
  } catch (e) {
    console.error("createEvent error:", e);
    return NextResponse.json(
      { ok: false, error: "create_event_failed" },
      { status: 500 }
    );
  }
}