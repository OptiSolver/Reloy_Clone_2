export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PresenceQuerySchema, computeCustomerPresence, EventTypeSchema } from "@loop/core";
import { pool } from "@loop/db";

/**
 * GET /api/presence
 * Query:
 * - merchant_id (requerido)
 * - customer_id (requerido)
 *
 * Respuesta:
 * { ok: true, customer_presence: "in" | "out" }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const parsed = PresenceQuerySchema.parse({
      merchant_id: url.searchParams.get("merchant_id"),
      customer_id: url.searchParams.get("customer_id"),
    });

    // Traemos el último evento del customer en ese merchant
    const sql = `
      SELECT type, occurred_at
      FROM events
      WHERE merchant_id = $1
        AND customer_id = $2
      ORDER BY occurred_at DESC
      LIMIT 1
    `;

    const result = await pool.query(sql, [parsed.merchant_id, parsed.customer_id]);

    // Si no hay eventos, por defecto está "out"
    if (result.rows.length === 0) {
      return NextResponse.json({
        ok: true,
        customer_presence: "out",
      });
    }

    const last = result.rows[0] as { type: string; occurred_at: string | Date };

    const parsedType = EventTypeSchema.safeParse(last.type);
    if (!parsedType.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_event_type", last_type: last.type },
        { status: 400 }
      );
    }

    const presence = computeCustomerPresence({
      lastEventType: parsedType.data,
      lastEventAt: new Date(last.occurred_at),
    });

    return NextResponse.json({
      ok: true,
      customer_presence: presence,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
