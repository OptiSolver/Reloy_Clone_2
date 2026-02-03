export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  EventsQuerySchema,
  EventTypeSchema,
  computeCustomerStatus,
  computeCustomerPresence,
  type EventType,
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

/**
 * GET /api/customers/summary
 *
 * Query:
 * - merchant_id (req)
 * - customer_id (req)
 * - branch_id (opt)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const parsedBase = EventsQuerySchema.parse({
      merchant_id: url.searchParams.get("merchant_id"),
      customer_id: url.searchParams.get("customer_id") || undefined,
      branch_id: url.searchParams.get("branch_id") || undefined,
      limit: "1",
    });

    if (!parsedBase.customer_id) {
      return NextResponse.json(
        { ok: false, error: "customer_id es requerido" },
        { status: 400 }
      );
    }

    const where: string[] = ["merchant_id = $1", "customer_id = $2"];
    const params: Array<string | number> = [
      parsedBase.merchant_id,
      parsedBase.customer_id,
    ];

    if (parsedBase.branch_id) {
      params.push(parsedBase.branch_id);
      where.push(`branch_id = $${params.length}`);
    }

    // 1) total events
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM events
      WHERE ${where.join(" AND ")}
    `;

    const countRes = await pool.query(countSql, params);
    const totalEvents = Number(countRes.rows?.[0]?.total ?? 0);

    // 2) último evento
    const lastSql = `
      SELECT type, occurred_at
      FROM events
      WHERE ${where.join(" AND ")}
      ORDER BY occurred_at DESC
      LIMIT 1
    `;

    const lastRes = await pool.query(lastSql, params);
    const lastRow = lastRes.rows?.[0] as
      | { type?: unknown; occurred_at?: string }
      | undefined;

    const lastEventAt = lastRow?.occurred_at
      ? new Date(lastRow.occurred_at)
      : null;

    // validamos el type con Zod (sin importar zod acá)
    const parsedType = EventTypeSchema.safeParse(lastRow?.type);
    const lastEventType: EventType | null = parsedType.success
      ? parsedType.data
      : null;

    // 3) status + presence
    const customerStatus =
      lastEventAt && totalEvents > 0
        ? computeCustomerStatus({ lastEventAt, totalEvents })
        : null;

    const customerPresence =
      lastEventAt && lastEventType
        ? computeCustomerPresence({ lastEventAt, lastEventType })
        : null;

    return NextResponse.json({
      ok: true,

      merchant_id: parsedBase.merchant_id,
      customer_id: parsedBase.customer_id,
      branch_id: parsedBase.branch_id ?? null,

      total_events: totalEvents,

      last_event_type: lastEventType,
      last_event_at: lastEventAt ? lastEventAt.toISOString() : null,
      last_event_at_local: lastEventAt ? toArgentinaTimeString(lastEventAt) : null,

      customer_status: customerStatus,
      customer_presence: customerPresence,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}