import { NextResponse } from "next/server";
import { CreateEventInputSchema, createEvent } from "@loop/core";

/**
 * POST /api/events
 * MVP: valida input (contrato) → inserta en DB vía core → responde JSON
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1) Validación + normalización (snake_case/camelCase → snake_case)
    const parsed = CreateEventInputSchema.parse(body);

    // 2) Inserta en DB (core)
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