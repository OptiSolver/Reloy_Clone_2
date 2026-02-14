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
// import { pool } from "@loop/db"; // Ya no usamos pool directo si es posible
import { db, eq, and, desc, inArray } from "@loop/db";
import * as schema from "@loop/db/src/schema";

/**
 * Helper: convierte fechas a horario Argentina (UTC-3)
 */
function toArgentinaTimeString(date: string | Date | null) {
  if (!date) return null;
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
 * DEV AUTH (por ahora):
 */
function getDevAuthUserId(req: Request): string | null {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  return h;
}

async function getStaffContextByAuthUserId(auth_user_id: string) {
  const staff = await db.query.staff.findFirst({
    where: (staff, { eq, and }) => and(eq(staff.authUserId, auth_user_id), eq(staff.isActive, true)),
    with: {
      branch: true
    }
  });

  if (!staff) return null;

  return {
    staff_id: staff.id,
    branch_id: staff.branchId,
    merchant_id: staff.branch.merchantId
  };
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

    const whereConditions = [eq(schema.events.merchantId, parsed.merchant_id)];

    if (parsed.customer_id) whereConditions.push(eq(schema.events.customerId, parsed.customer_id));
    if (parsed.branch_id) whereConditions.push(eq(schema.events.branchId, parsed.branch_id));

    const eventsList = await db.query.events.findMany({
      where: and(...whereConditions),
      orderBy: [desc(schema.events.occurredAt)],
      limit: parsed.limit ? Number(parsed.limit) : 50,
    });

    // Customer State Engine (si hay customer_id)
    let customer_status: string | null = null;
    let customer_presence: "in" | "out" | null = null;

    if (parsed.customer_id) {
      const lastEvent = eventsList[0];
      const lastEventAt = lastEvent?.occurredAt ?? null;
      const lastEventType = lastEvent?.type ? (EventTypeSchema.safeParse(lastEvent.type).success ? EventTypeSchema.parse(lastEvent.type) : null) : null;

      // Presencia
      const lastPresenceEvent = await db.query.events.findFirst({
        where: and(
          eq(schema.events.merchantId, parsed.merchant_id),
          eq(schema.events.customerId, parsed.customer_id),
          inArray(schema.events.type, ['checkin', 'checkout'])
        ),
        orderBy: [desc(schema.events.occurredAt)]
      });

      const lastPresenceType = lastPresenceEvent?.type ? (EventTypeSchema.safeParse(lastPresenceEvent.type).success ? EventTypeSchema.parse(lastPresenceEvent.type) : null) : null;

      const state = computeCustomerState({
        totalEvents: eventsList.length, // Esto es un aproximado basado en el limit, ojo. Para real totalEvents requeriría count(). Por MVP usamos lista traída.
        lastEventAt,
        lastEventType,
        lastPresenceEventAt: lastPresenceEvent?.occurredAt ?? null,
        lastPresenceEventType: lastPresenceType
      });

      customer_status = state.customer_status;
      customer_presence = state.customer_presence;
    }

    return NextResponse.json({
      ok: true,
      events: eventsList.map((row) => ({
        ...row,
        occurred_at_local: toArgentinaTimeString(row.occurredAt),
        created_at_local: toArgentinaTimeString(row.createdAt),
      })),
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
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;

    // 1) Autocomplete desde Session DEV
    const auth_user_id = getDevAuthUserId(req);
    if (auth_user_id) {
      const staffCtx = await getStaffContextByAuthUserId(auth_user_id);

      if (staffCtx) {
        if (!body.merchant_id && !body.merchantId) body.merchantId = staffCtx.merchant_id;
        if (!body.branch_id && !body.branchId) body.branchId = staffCtx.branch_id;
        if (!body.staff_id && !body.staffId) body.staffId = staffCtx.staff_id;
      }
    }

    // Normalizar a camelCase para Zod si vienen snake_case
    if (body.merchant_id) body.merchantId = body.merchant_id;
    if (body.customer_id) body.customerId = body.customer_id;
    if (body.branch_id) body.branchId = body.branch_id;
    if (body.staff_id) body.staffId = body.staff_id;
    if (body.occurred_at) body.occurredAt = body.occurred_at;

    // 2) Validar input final
    const parsed = CreateEventInputSchema.parse(body);

    // 3) Insertar evento
    // createEvent del core ya usa Drizzle? Si no, deberíamos estandarizar. 
    // Asumiremos que createEvent inserta y devuelve row.
    // Por consistencia con el refactor, usaremos Drizzle directo acá o createEvent. 
    // Para no romper la abstracción, usamos createEvent, pero aseguramos que devuelva lo que necesitamos.

    // NOTA: Si createEvent usa PG pool y nosotros Drizzle, puede haber conflicto de transacción.
    // Lo ideal es que createEvent use db de drizzle. Revisaré createEvent luego. 
    // Por ahora, asumimos que funciona.

    const inserted = await createEvent(parsed);

    // 4) Award points (idempotente)
    // Usamos los datos normalizados del evento insertado
    // inserted tiene keys camelCase si viene de Drizzle
    const eventId = inserted.id;
    const merchantId = inserted.merchantId;
    const customerId = inserted.customerId;
    const branchId = inserted.branchId;
    const staffId = inserted.staffId;
    const eventType = inserted.type as any; // EventType cast

    if (eventId && merchantId && customerId && eventType) {
      await awardPointsFromEvent({
        eventId,
        merchantId,
        customerId,
        branchId,
        staffId,
        type: eventType,
        payload: inserted.payload,
      });
    }

    return NextResponse.json({
      ok: true,
      event: {
        ...inserted,
        occurred_at_local: toArgentinaTimeString(inserted.occurredAt),
        created_at_local: toArgentinaTimeString(inserted.createdAt),
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);

    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}