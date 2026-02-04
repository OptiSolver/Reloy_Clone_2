export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  EventsQuerySchema,
  computeCustomerState,
  EventTypeSchema,
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
 * Query:
 * - merchant_id (req)
 * - customer_id (req)
 * - branch_id (opt)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Reusamos EventsQuerySchema pero customer_id es obligatorio acá
    const parsed = EventsQuerySchema.parse({
      merchant_id: url.searchParams.get("merchant_id"),
      customer_id: url.searchParams.get("customer_id") || undefined,
      branch_id: url.searchParams.get("branch_id") || undefined,
      limit: "1",
    });

    if (!parsed.customer_id) {
      return NextResponse.json(
        { ok: false, error: "customer_id es requerido" },
        { status: 400 }
      );
    }

    const where: string[] = ["merchant_id = $1", "customer_id = $2"];
    const params: Array<string | number> = [
      parsed.merchant_id,
      parsed.customer_id,
    ];

    if (parsed.branch_id) {
      params.push(parsed.branch_id);
      where.push(`branch_id = $${params.length}`);
    }

    /**
     * 1) Total de eventos
     */
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM events
      WHERE ${where.join(" AND ")}
    `;
    const countRes = await pool.query(countSql, params);
    const totalEvents = Number(countRes.rows?.[0]?.total ?? 0);

    /**
     * 2) Último evento general
     */
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

    const lastEventType = (() => {
      if (!lastRow?.type) return null;
      const parsedType = EventTypeSchema.safeParse(lastRow.type);
      return parsedType.success ? parsedType.data : null;
    })();

    /**
     * 3) Último evento de presencia (checkin / checkout)
     * 👉 CLAVE: no depende del último evento general
     */
    const lastPresenceRes = await pool.query(
      `
      SELECT type, occurred_at
      FROM events
      WHERE merchant_id = $1
        AND customer_id = $2
        AND type IN ('checkin', 'checkout')
      ORDER BY occurred_at DESC
      LIMIT 1
      `,
      [parsed.merchant_id, parsed.customer_id]
    );

    const lastPresenceRow = lastPresenceRes.rows?.[0] as
      | { type?: unknown; occurred_at?: string }
      | undefined;

    const lastPresenceEventAt = lastPresenceRow?.occurred_at
      ? new Date(lastPresenceRow.occurred_at)
      : null;

    const lastPresenceEventType = (() => {
      if (!lastPresenceRow?.type) return null;
      const parsedType = EventTypeSchema.safeParse(lastPresenceRow.type);
      return parsedType.success ? parsedType.data : null;
    })();

    /**
     * 4) Estado del cliente (única fuente de verdad)
     */
    const state = computeCustomerState({
      totalEvents,
      lastEventAt,
      lastEventType,
      lastPresenceEventAt,
      lastPresenceEventType,
    });

    return NextResponse.json({
      ok: true,

      merchant_id: parsed.merchant_id,
      customer_id: parsed.customer_id,
      branch_id: parsed.branch_id ?? null,

      total_events: state.total_events,
      last_event_type: state.last_event_type,
      last_event_at: state.last_event_at
        ? state.last_event_at.toISOString()
        : null,
      last_event_at_local: state.last_event_at
        ? toArgentinaTimeString(state.last_event_at)
        : null,

      customer_status: state.customer_status,
      customer_presence: state.customer_presence,

      // DEBUG ÚTIL (no viene del core, lo armamos acá)
      last_presence_event_type: lastPresenceEventType ?? null,
      last_presence_event_at: lastPresenceEventAt
        ? lastPresenceEventAt.toISOString()
        : null,
      last_presence_event_at_local: lastPresenceEventAt
        ? toArgentinaTimeString(lastPresenceEventAt)
        : null,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}