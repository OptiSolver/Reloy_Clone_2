export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { CreateEventInputSchema, createEvent, EventsQuerySchema } from "@loop/core";
import { pool } from "@loop/db";
import { computeCustomerStatus } from "@loop/core";

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
    let customerStatus = null;

if (parsed.customer_id && result.rows.length > 0) {
  const lastEvent = result.rows[0];

  customerStatus = computeCustomerStatus({
    lastEventAt: new Date(lastEvent.occurred_at),
    totalEvents: result.rows.length,
  });
}

   return NextResponse.json({
  ok: true,
  events: result.rows,
  customer_status: customerStatus,
});

  } catch (error: unknown) {
    // si es Zod, devolvemos 400 con detalle
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}

/**
 * POST /api/events
 * valida input (contrato) → inserta en DB vía core → responde JSON
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = CreateEventInputSchema.parse(body);
    const inserted = await createEvent(parsed);

    return NextResponse.json({
      ok: true,
      event: inserted,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 400 }
    );
  }
}