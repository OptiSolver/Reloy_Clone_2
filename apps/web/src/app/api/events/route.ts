import { NextResponse } from "next/server";
import { CreateEventInputSchema } from "@loop/core";

/**
 * POST /api/events
 * MVP: valida input y responde OK
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const parsed = CreateEventInputSchema.parse(body);

    return NextResponse.json({
      ok: true,
      event: parsed
    });
} catch (error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown error";

  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status: 400 }
  );
}
}