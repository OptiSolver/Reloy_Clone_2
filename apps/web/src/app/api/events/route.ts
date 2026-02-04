export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  CreateEventInputSchema,
  createEvent,
  EventsQuerySchema,
  computeCustomerState,
  EventTypeSchema,
  awardPointsFromEvent,
} from "@loop/core";
import { pool } from "@loop/db";

/**
 * Helper: convierte fechas a horario Argentina (UTC-3)
 * Devuelve string "YYYY-MM-DD HH:mm:ss"
 */
function toArgentinaTimeString(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace("T", " ");
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

/**
 * DEV AUTH (por ahora):
 * - usamos header x-auth-user-id
 */
function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (!h) return null;
  return isUuid(h) ? h : null;
}

type StaffContext = {
  staff_id: string;
  branch_id: string;
  merchant_id: string;
};

async function getStaffContextByAuthUserId(
  auth_user_id: string
): Promise<StaffContext | null> {
  const res = await pool.query<{
    staff_id: string;
    branch_id: string;
    merchant_id: string;
  }>(
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
 * Row flexible: puede venir snake_case (DB) o camelCase (core / mappers)
 */
type EventRow = Record<string, unknown> & {
  id?: unknown;

  merchant_id?: unknown;
  customer_id?: unknown;
  branch_id?: unknown;
  staff_id?: unknown;

  merchantId?: unknown;
  customerId?: unknown;
  branchId?: unknown;
  staffId?: unknown;

  type?: unknown;
  payload?: unknown;

  occurred_at?: string | Date;
  created_at?: string | Date;

  occurredAt?: string | Date;
  createdAt?: string | Date;
};

function getOccurredAt(row: EventRow): string | Date | null {
  return (row.occurred_at ?? row.occurredAt ?? null) as string | Date | null;
}

function getCreatedAt(row: EventRow): string | Date | null {
  return (row.created_at ?? row.createdAt ?? null) as string | Date | null;
}

function getEventType(row: EventRow) {
  if (!row.type) return null;
  const parsed = EventTypeSchema.safeParse(row.type);
  return parsed.success ? parsed.data : null;
}

function getInsertedId(row: EventRow): string | null {
  const id = row.id as string | undefined;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function getMerchantId(row: EventRow): string | null {
  const v = (row.merchant_id ?? row.merchantId) as string | undefined;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getCustomerId(row: EventRow): string | null {
  const v = (row.customer_id ?? row.customerId) as string | undefined;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getBranchId(row: EventRow): string | null {
  const v = (row.branch_id ?? row.branchId) as string | undefined;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getStaffId(row: EventRow): string | null {
  const v = (row.staff_id ?? row.staffId) as string | undefined;
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * GET /api/events
 * Timeline de eventos
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const parsed = EventsQuerySchema.parse({
      merchant_id: url.searchParams.get("merchant_id"),
      customer_id: url.searchParams.get("customer_id") || undefined,
      branch_id: url.searchParams.get("branch_id") || undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const where: string[] = ["merchant_id = $1"];
    const params: Array<string | number> = [parsed.merchant_id];

    if (parsed.customer_id) {
      params.push(parsed.customer_id);
      where.push(`customer_id = $${params.length}`);
    }

    if (parsed.branch_id) {
      params.push(parsed.branch_id);
      where.push(`branch_id = $${params.length}`);
    }

    params.push(parsed.limit);

    const sql = `
      SELECT *
      FROM events
      WHERE ${where.join(" AND ")}
      ORDER BY occurred_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(sql, params);

    // Customer State Engine (si hay customer_id)
    let customer_status: string | null = null;
    let customer_presence: "in" | "out" | null = null;

    if (parsed.customer_id) {
      const last = (result.rows?.[0] ?? null) as EventRow | null;

      const lastEventAtRaw = last ? getOccurredAt(last) : null;
      const lastEventAt = lastEventAtRaw ? new Date(lastEventAtRaw) : null;

      const lastEventType = last ? getEventType(last) : null;

      // presencia según último checkin/checkout
      const lastPresenceRes = await pool.query(
        `
        SELECT type, occurred_at
        FROM events
        WHERE merchant_id = $1
          AND customer_id = $2
          AND type IN ('checkin','checkout')
        ORDER BY occurred_at DESC
        LIMIT 1
        `,
        [parsed.merchant_id, parsed.customer_id]
      );

      const lastPresenceRow = (lastPresenceRes.rows?.[0] ?? null) as
        | { type?: unknown; occurred_at?: string | Date }
        | null;

      const lastPresenceAtRaw = lastPresenceRow?.occurred_at ?? null;
      const lastPresenceAt = lastPresenceAtRaw
        ? new Date(lastPresenceAtRaw)
        : null;

      const lastPresenceType = lastPresenceRow?.type
        ? EventTypeSchema.safeParse(lastPresenceRow.type).success
          ? EventTypeSchema.parse(lastPresenceRow.type)
          : null
        : null;

      const state = computeCustomerState({
        totalEvents: result.rows.length,
        lastEventAt,
        lastEventType,
        lastPresenceEventAt: lastPresenceAt,
        lastPresenceEventType: lastPresenceType,
      });

      customer_status = state.customer_status;
      customer_presence = state.customer_presence;
    }

    return NextResponse.json({
      ok: true,
      events: (result.rows as EventRow[]).map((row) => {
        const occurred = getOccurredAt(row);
        const created = getCreatedAt(row);

        return {
          ...row,
          occurred_at_local: occurred ? toArgentinaTimeString(occurred) : null,
          created_at_local: created ? toArgentinaTimeString(created) : null,
        };
      }),
      customer_status,
      customer_presence,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * POST /api/events
 * Ahora: si viene x-auth-user-id, autocompleta merchant_id/branch_id/staff_id
 * cuando no estén presentes en el body.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // 1) Autocomplete desde Session DEV (solo si faltan campos)
    const auth_user_id = getDevAuthUserId(req);
    if (auth_user_id) {
      const staffCtx = await getStaffContextByAuthUserId(auth_user_id);

      if (staffCtx) {
        // Soportamos snake y camel (si el user manda cualquiera)
        if (!body.merchant_id && !body.merchantId) body.merchant_id = staffCtx.merchant_id;
        if (!body.branch_id && !body.branchId) body.branch_id = staffCtx.branch_id;

        // staff_id: solo lo completamos si no viene
        if (!body.staff_id && !body.staffId) body.staff_id = staffCtx.staff_id;
      }
    }

    // 2) Validar input final
    const parsed = CreateEventInputSchema.parse(body);

    // 3) Insertar evento
    const inserted = (await createEvent(parsed)) as EventRow;

    // 4) Award points (idempotente)
    const insertedId = getInsertedId(inserted);
    const merchantId = getMerchantId(inserted);
    const customerId = getCustomerId(inserted);
    const branchId = getBranchId(inserted);
    const staffId = getStaffId(inserted);
    const eventType = getEventType(inserted);

    if (insertedId && merchantId && customerId && eventType) {
      await awardPointsFromEvent({
        eventId: insertedId,
        merchantId,
        customerId,
        branchId,
        staffId,
        type: eventType,
        payload: (inserted.payload ?? null) as unknown,
      });
    }

    const occurred = getOccurredAt(inserted);
    const created = getCreatedAt(inserted);

    if (!occurred || !created) {
      return NextResponse.json(
        {
          ok: false,
          error: "La DB no devolvió occurred_at/created_at",
          debug_keys: inserted ? Object.keys(inserted) : null,
          debug_inserted: inserted ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      event: {
        ...inserted,
        occurred_at_local: toArgentinaTimeString(occurred),
        created_at_local: toArgentinaTimeString(created),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}