export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

function getAuthUserId(req: Request): string | null {
  return req.headers.get("x-auth-user-id");
}

export async function POST(req: Request) {
  const auth_user_id = getAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json(
      { ok: false, error: "missing_auth_user_id" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { step, data } = body ?? {};

  if (typeof step !== "number") {
    return NextResponse.json(
      { ok: false, error: "step_required" },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const ownerRes = await client.query(
      `
      SELECT id, onboarding_step
      FROM owners
      WHERE auth_user_id = $1
      LIMIT 1
      `,
      [auth_user_id]
    );

    const owner = ownerRes.rows[0];

    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "owner_not_found" },
        { status: 404 }
      );
    }

    // 🚫 no permitir saltos
    if (step !== owner.onboarding_step + 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_step_sequence",
          expected: owner.onboarding_step + 1,
        },
        { status: 400 }
      );
    }

    /**
     * STEP 1 — Nombre y apellido
     */
    if (step === 1) {
      const { first_name, last_name } = data ?? {};

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
    }

    /**
     * STEP 2 — Comercio básico
     */
    if (step === 2) {
      const { merchant_name, city } = data ?? {};

      if (!merchant_name || !city) {
        return NextResponse.json(
          { ok: false, error: "merchant_name_and_city_required" },
          { status: 400 }
        );
      }

      await client.query(
        `
        INSERT INTO merchants (owner_id, name, city)
        VALUES ($1, $2, $3)
        `,
        [owner.id, merchant_name, city]
      );

      await client.query(
        `
        UPDATE owners
        SET onboarding_step = 2
        WHERE id = $1
        `,
        [owner.id]
      );
    }

    /**
     * STEP 3 — Rubro
     */
    if (step === 3) {
      const { industry } = data ?? {};

      if (!industry) {
        return NextResponse.json(
          { ok: false, error: "industry_required" },
          { status: 400 }
        );
      }

      const merchantRes = await client.query(
        `
        SELECT id
        FROM merchants
        WHERE owner_id = $1
        LIMIT 1
        `,
        [owner.id]
      );

      const merchant = merchantRes.rows[0];

      if (!merchant) {
        return NextResponse.json(
          { ok: false, error: "merchant_not_found" },
          { status: 400 }
        );
      }

      await client.query(
        `
        INSERT INTO merchant_settings (merchant_id, industry)
        VALUES ($1, $2)
        ON CONFLICT (merchant_id) DO NOTHING
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
    }

    return NextResponse.json({
      ok: true,
      step_completed: step,
    });
  } finally {
    client.release();
  }
}