export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

function getAuthUserId(req: Request): string | null {
  return req.headers.get("x-auth-user-id");
}

/** Tipo mínimo para no depender de `pg` */
type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
};

type PgErrorShape = {
  message?: unknown;
  code?: unknown;
  detail?: unknown;
  hint?: unknown;
  where?: unknown;
  constraint?: unknown;
  table?: unknown;
  column?: unknown;
  schema?: unknown;
};

function errToJson(e: unknown) {
  const obj = (typeof e === "object" && e !== null ? (e as PgErrorShape) : {}) as PgErrorShape;

  const message =
    e instanceof Error
      ? e.message
      : typeof obj.message === "string"
        ? obj.message
        : String(e);

  const pick = (v: unknown) => (typeof v === "string" ? v : undefined);

  return {
    message,
    code: pick(obj.code),
    detail: pick(obj.detail),
    hint: pick(obj.hint),
    where: pick(obj.where),
    constraint: pick(obj.constraint),
    table: pick(obj.table),
    column: pick(obj.column),
    schema: pick(obj.schema),
  };
}

type StepPayload = {
  step: number;
  data?: Record<string, unknown>;
};

async function getOwner(client: DbClient, authUserId: string) {
  const ownerRes = await client.query(
    `
    SELECT id, onboarding_step
    FROM owners
    WHERE auth_user_id = $1
    LIMIT 1
    `,
    [authUserId]
  );

  const row = ownerRes.rows[0] as { id: string; onboarding_step: number } | undefined;
  return row ?? null;
}

export async function POST(req: Request) {
  const auth_user_id = getAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json({ ok: false, error: "missing_auth_user_id" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as StepPayload | null;
  const step = body?.step;
  const data = body?.data ?? {};

  if (typeof step !== "number") {
    return NextResponse.json({ ok: false, error: "step_required" }, { status: 400 });
  }

  const client = (await pool.connect()) as unknown as DbClient;

  try {
    const owner = await getOwner(client, auth_user_id);

    if (!owner) {
      return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 404 });
    }

    // No permitir saltos
    const expected = owner.onboarding_step + 1;
    if (step !== expected) {
      return NextResponse.json(
        { ok: false, error: "invalid_step_sequence", expected },
        { status: 400 }
      );
    }

    if (step === 1) {
      const first_name = typeof data.first_name === "string" ? data.first_name.trim() : "";
      const last_name = typeof data.last_name === "string" ? data.last_name.trim() : "";

      if (!first_name || !last_name) {
        return NextResponse.json(
          { ok: false, error: "first_name_and_last_name_required" },
          { status: 400 }
        );
      }

      await client.query(
        `
        UPDATE owners
        SET first_name = $1,
            last_name = $2,
            onboarding_step = 1
        WHERE id = $3
        `,
        [first_name, last_name, owner.id]
      );

      return NextResponse.json({ ok: true, step_completed: 1 });
    }

    if (step === 2) {
      const merchant_name =
        typeof data.merchant_name === "string" ? data.merchant_name.trim() : "";
      const city = typeof data.city === "string" ? data.city.trim() : "";
      const zone = typeof data.zone === "string" ? data.zone.trim() : "";

      if (!merchant_name || !city) {
        return NextResponse.json(
          { ok: false, error: "merchant_name_and_city_required" },
          { status: 400 }
        );
      }

      // Upsert merchant base (name). City/zone quedan para schema futuro.
      const existingRes = await client.query(
        `
        SELECT id
        FROM merchants
        WHERE owner_id = $1
        ORDER BY id ASC
        LIMIT 1
        `,
        [owner.id]
      );

      const existing = existingRes.rows[0] as { id: string } | undefined;

      if (existing) {
        await client.query(
          `
          UPDATE merchants
          SET name = $1
          WHERE id = $2
          `,
          [merchant_name, existing.id]
        );
      } else {
        await client.query(
          `
          INSERT INTO merchants (owner_id, name)
          VALUES ($1, $2)
          `,
          [owner.id, merchant_name]
        );
      }

      // Por ahora no persisten
      void zone;
      void city;

      await client.query(
        `
        UPDATE owners
        SET onboarding_step = 2
        WHERE id = $1
        `,
        [owner.id]
      );

      return NextResponse.json({ ok: true, step_completed: 2 });
    }

    if (step === 3) {
      const industry = typeof data.industry === "string" ? data.industry.trim() : "";

      if (!industry) {
        return NextResponse.json({ ok: false, error: "industry_required" }, { status: 400 });
      }

      const merchantRes = await client.query(
        `
        SELECT id
        FROM merchants
        WHERE owner_id = $1
        ORDER BY id ASC
        LIMIT 1
        `,
        [owner.id]
      );

      const merchant = merchantRes.rows[0] as { id: string } | undefined;

      if (!merchant) {
        return NextResponse.json({ ok: false, error: "merchant_not_found" }, { status: 400 });
      }

      await client.query(
        `
        INSERT INTO merchant_settings (merchant_id, industry)
        VALUES ($1, $2)
        ON CONFLICT (merchant_id) DO UPDATE SET industry = EXCLUDED.industry
        `,
        [merchant.id, industry]
      );

      await client.query(
        `
        UPDATE owners
        SET onboarding_step = 3
        WHERE id = $1
        `,
        [owner.id]
      );

      return NextResponse.json({ ok: true, step_completed: 3 });
    }

    return NextResponse.json({ ok: false, error: "invalid_step" }, { status: 400 });
  } catch (e) {
    console.error("[api/owner/onboarding/steps] error:", e);
    return NextResponse.json(
      { ok: false, error: "server_error", debug: errToJson(e) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}