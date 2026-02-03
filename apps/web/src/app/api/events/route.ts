export const runtime = "nodejs";

import { NextResponse } from "next/server";
import {
  CreateEventInputSchema,
  createEvent,
  EventsQuerySchema,
  computeCustomerStatus,
} from "@loop/core";
import { pool } from "@loop/db";

/**
 * Helper: convierte fechas a horario Argentina (UTC-3)
 * Devuelve string "YYYY-MM-DD HH:mm:ss" (ideal para JSON)
 */
function toArgentinaTimeString(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;

  // "sv-SE" => formato muy cómodo: "YYYY-MM-DD HH:mm:ss"
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
 * Row flexible: puede venir en snake_case (DB)
 * o camelCase (core / mappers)
 */
type EventRow = Record<string, unknown> & {
  occurred_at?: string | Date;
  created_at?: string | Date;
  occurredAt?: string | Date;
  createdAt?: string | Date;
};

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

    let customerStatus: string | null = null;

    if (parsed.customer_id && result.rows.length > 0) {
      const last = result.rows[0] as EventRow;
      const lastEventAt = last.occurred_at ?? last.occurredAt;

      if (lastEventAt) {
        customerStatus = computeCustomerStatus({
          lastEventAt: new Date(lastEventAt),
          totalEvents: result.rows.length,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      events: (result.rows as EventRow[]).map((row) => {
        const occurred = row.occurred_at ?? row.occurredAt;
        const created = row.created_at ?? row.createdAt;

        return {
          ...row,
          occurred_at_local: occurred ? toArgentinaTimeString(occurred) : null,
          created_at_local: created ? toArgentinaTimeString(created) : null,
        };
      }),
      customer_status: customerStatus,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * POST /api/events
 * Valida input → inserta en DB → responde evento creado
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = CreateEventInputSchema.parse(body);
    const inserted = (await createEvent(parsed)) as EventRow;

    const occurred = inserted?.occurred_at ?? inserted?.occurredAt;
    const created = inserted?.created_at ?? inserted?.createdAt;

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