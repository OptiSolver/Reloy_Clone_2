export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@loop/db";
import { randomUUID } from "crypto";

/* =========================
   TIPOS
========================= */

type Body = {
  business_name?: string;
};

type DbErrorLike = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  where?: string;
  constraint?: string;
  table?: string;
  column?: string;
  schema?: string;
};

/* =========================
   HELPERS
========================= */

function errToJson(e: unknown) {
  const err = typeof e === "object" && e !== null ? (e as DbErrorLike) : {};

  return {
    message: err.message ?? String(e),
    code: err.code,
    detail: err.detail,
    hint: err.hint,
    where: err.where,
    constraint: err.constraint,
    table: err.table,
    column: err.column,
    schema: err.schema,
  };
}

async function getAuthUserId(): Promise<string | null> {
  const c = await cookies();
  return c.get("dev_auth_user_id")?.value ?? null;
}

/* =========================
   ROUTE
========================= */

export async function POST(req: Request) {
  const authUserId = await getAuthUserId();
  if (!authUserId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const businessName = String(body.business_name ?? "").trim();

  if (!businessName) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // (A) Si ya existe owner para este auth_user_id, devolvemos el existente (idempotente)
    const existingOwner = await client.query(
      `select id from owners where auth_user_id = $1 limit 1`,
      [authUserId]
    );

    let ownerId: string;

    if (existingOwner.rowCount && existingOwner.rows[0]?.id) {
      ownerId = String(existingOwner.rows[0].id);
    } else {
      const ownerRes = await client.query(
        `
        insert into owners (id, auth_user_id)
        values ($1, $2)
        returning id
        `,
        [randomUUID(), authUserId]
      );

      ownerId = String(ownerRes.rows[0].id);
    }

    // (B) Crear merchant (si ya existe uno con mismo nombre para el owner, devolvemos el existente)
    const existingMerchant = await client.query(
      `
      select id
      from merchants
      where owner_id = $1 and lower(name) = lower($2)
      limit 1
      `,
      [ownerId, businessName]
    );

    let merchantId: string;

    if (existingMerchant.rowCount && existingMerchant.rows[0]?.id) {
      merchantId = String(existingMerchant.rows[0].id);
    } else {
      const merchantRes = await client.query(
        `
        insert into merchants (id, owner_id, name)
        values ($1, $2, $3)
        returning id
        `,
        [randomUUID(), ownerId, businessName]
      );

      merchantId = String(merchantRes.rows[0].id);
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      owner_id: ownerId,
      merchant_id: merchantId,
    });
  } catch (e) {
    await client.query("ROLLBACK");

    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        debug: errToJson(e),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}