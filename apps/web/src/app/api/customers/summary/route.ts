export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { EventsQuerySchema, computeCustomerState, EventTypeSchema } from "@loop/core";
import { pool } from "@loop/db";

/**
 * Helper: convierte fechas a horario Argentina (UTC-3)
 * Devuelve string "YYYY-MM-DD HH:mm:ss" (ideal para JSON)
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
 * Query:
 * - merchant_id (req)
 * - customer_id (req)
 * - branch_id (opt)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Reusamos EventsQuerySchema pero obligamos customer_id acá
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

    // 2) last event
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

    const lastEventAt = lastRow?.occurred_at ? new Date(lastRow.occurred_at) : null;

    // Validamos que el type sea uno de los permitidos (EventTypeSchema)
    const lastEventType = (() => {
      if (!lastRow?.type) return null;
      const parsed = EventTypeSchema.safeParse(lastRow.type);
      return parsed.success ? parsed.data : null;
    })();

    // 3) Customer State (única fuente)
    const state = computeCustomerState({
      totalEvents,
      lastEventAt,
      lastEventType,
    });

    return NextResponse.json({
      ok: true,
      merchant_id: parsedBase.merchant_id,
      customer_id: parsedBase.customer_id,
      branch_id: parsedBase.branch_id ?? null,

      total_events: state.total_events,
      last_event_type: state.last_event_type,
      last_event_at: state.last_event_at ? state.last_event_at.toISOString() : null,
      last_event_at_local: state.last_event_at ? toArgentinaTimeString(state.last_event_at) : null,

      customer_status: state.customer_status,
      customer_presence: state.customer_presence,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}