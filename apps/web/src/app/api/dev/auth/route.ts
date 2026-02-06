export const runtime = "nodejs";

import { NextResponse } from "next/server";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * DEV ONLY
 * Setea cookie "dev_auth_user_id" para que el server la use en fetches.
 *
 * GET /api/dev/auth?auth_user_id=<uuid>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const auth_user_id = url.searchParams.get("auth_user_id");

  if (!isUuid(auth_user_id)) {
    return NextResponse.json(
      { ok: false, error: "invalid_auth_user_id" },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ ok: true, auth_user_id });

  // cookie accesible al server (httpOnly)
  res.cookies.set("dev_auth_user_id", auth_user_id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return res;
}