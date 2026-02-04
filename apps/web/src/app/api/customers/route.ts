export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { pool } from "@loop/db";

/**
 * /api/customers
 *
 * POST: crear/buscar customer por identificador (phone/email/external/qr)
 *       y asegurar membership en merchant.
 *
 * GET:
 *  - List:   /api/customers?merchant_id=...&q=...&limit=...
 *  - Get one:/api/customers?merchant_id=...&customer_id=...
 *
 * Sin zod (para no depender de deps en apps/web).
 */

type IdentifierType = "phone" | "email" | "external" | "qr";

type CreateCustomerBody = {
  merchant_id: string;
  branch_id?: string;
  staff_id?: string;
  identifier: {
    type: IdentifierType;
    value: string;
  };
};

type PgRow<T> = { rows: T[] };

type PgClient = {
  query: <T = unknown>(
    sql: string,
    params?: readonly unknown[]
  ) => Promise<PgRow<T>>;
};

type MembershipRow = {
  id: string;
  merchant_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type CustomerIdentifierRow = {
  id: string;
  type: string;
  value_raw: string;
  value_normalized: string;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

type BalanceRow = { balance: string };

type LastEventRow = {
  id: string;
  type: string;
  occurred_at: string;
  branch_id: string | null;
  staff_id: string | null;
  payload: unknown;
};

type ListRow = {
  customer_id: string;
  identifier_type: string | null;
  identifier_value_raw: string | null;
  identifier_value_normalized: string | null;
  balance: number;
  last_event_type: string | null;
  last_event_at: string | null;
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function isIdentifierType(v: unknown): v is IdentifierType {
  return v === "phone" || v === "email" || v === "external" || v === "qr";
}

function normalizeIdentifier(type: IdentifierType, raw: string) {
  const v = raw.trim();

  if (type === "phone") {
    // solo dígitos (+54 9 381 123-4567 -> 5493811234567)
    return v.replace(/\D+/g, "");
  }

  if (type === "email") {
    return v.toLowerCase();
  }

  return v.toLowerCase();
}

function clampLimit(raw: string | null, def = 20, max = 100) {
  const n = raw ? Number(raw) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(Math.floor(n), max);
}

type IdRow = { id: string };
type CustomerIdRow = { customer_id: string };
type CustomerInsertedRow = { id: string };

async function membershipExistsTx(
  client: PgClient,
  merchantId: string,
  customerId: string
): Promise<boolean> {
  const res = await client.query<IdRow>(
    `
    SELECT id
    FROM memberships
    WHERE merchant_id = $1 AND customer_id = $2
    LIMIT 1
    `,
    [merchantId, customerId]
  );

  return Boolean(res.rows[0]?.id);
}

/**
 * GET /api/customers
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const merchant_id = url.searchParams.get("merchant_id");
    const customer_id = url.searchParams.get("customer_id");
    const q = url.searchParams.get("q");
    const limit = clampLimit(url.searchParams.get("limit"));

    if (!isUuid(merchant_id)) {
      return NextResponse.json(
        { ok: false, error: "merchant_id inválido" },
        { status: 400 }
      );
    }

    // =========================
    // GET ONE
    // =========================
    if (customer_id) {
      if (!isUuid(customer_id)) {
        return NextResponse.json(
          { ok: false, error: "customer_id inválido" },
          { status: 400 }
        );
      }

      const memRes = await pool.query<MembershipRow>(
        `
        SELECT id, merchant_id, customer_id, status, created_at, updated_at
        FROM memberships
        WHERE merchant_id = $1 AND customer_id = $2
        LIMIT 1
        `,
        [merchant_id, customer_id]
      );

      const membership = memRes.rows[0] ?? null;

      if (!membership) {
        return NextResponse.json(
          { ok: false, error: "membership_not_found" },
          { status: 404 }
        );
      }

      const idsRes = await pool.query<CustomerIdentifierRow>(
        `
        SELECT id, type, value_raw, value_normalized, is_primary, verified_at, created_at
        FROM customer_identifiers
        WHERE customer_id = $1
        ORDER BY is_primary DESC, created_at ASC
        `,
        [customer_id]
      );

      const balRes = await pool.query<BalanceRow>(
        `
        SELECT COALESCE(SUM(delta_points), 0)::text AS balance
        FROM points_ledger
        WHERE merchant_id = $1 AND customer_id = $2
        `,
        [merchant_id, customer_id]
      );

      const balance = Number(balRes.rows[0]?.balance ?? 0);

      const lastRes = await pool.query<LastEventRow>(
        `
        SELECT id, type, occurred_at, branch_id, staff_id, payload
        FROM events
        WHERE merchant_id = $1 AND customer_id = $2
        ORDER BY occurred_at DESC
        LIMIT 1
        `,
        [merchant_id, customer_id]
      );

      return NextResponse.json({
        ok: true,
        merchant_id,
        customer_id,
        membership,
        identifiers: idsRes.rows,
        balance,
        last_event: lastRes.rows[0] ?? null,
      });
    }

    // =========================
    // LIST
    // =========================
    const params: Array<string | number> = [merchant_id, limit];
    let where = "m.merchant_id = $1";

    if (q && q.trim().length > 0) {
      const raw = q.trim();
      const digits = raw.replace(/\D+/g, "");
      const search = digits.length >= 6 ? digits : raw.toLowerCase();

      params.push(`%${search}%`);
      where += ` AND EXISTS (
        SELECT 1
        FROM customer_identifiers ci
        WHERE ci.customer_id = m.customer_id
          AND ci.value_normalized ILIKE $${params.length}
      )`;
    }

    const sql = `
      SELECT
        m.customer_id,
        ci.type AS identifier_type,
        ci.value_raw AS identifier_value_raw,
        ci.value_normalized AS identifier_value_normalized,
        COALESCE((
          SELECT SUM(pl.delta_points)
          FROM points_ledger pl
          WHERE pl.merchant_id = m.merchant_id
            AND pl.customer_id = m.customer_id
        ), 0)::int AS balance,
        le.type AS last_event_type,
        le.occurred_at AS last_event_at
      FROM memberships m
      LEFT JOIN LATERAL (
        SELECT type, value_raw, value_normalized
        FROM customer_identifiers
        WHERE customer_id = m.customer_id
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) ci ON true
      LEFT JOIN LATERAL (
        SELECT type, occurred_at
        FROM events
        WHERE merchant_id = m.merchant_id
          AND customer_id = m.customer_id
        ORDER BY occurred_at DESC
        LIMIT 1
      ) le ON true
      WHERE ${where}
      ORDER BY le.occurred_at DESC NULLS LAST, m.created_at DESC
      LIMIT $2
    `;

    const listRes = await pool.query<ListRow>(sql, params);

    return NextResponse.json({
      ok: true,
      merchant_id,
      count: listRes.rows.length,
      customers: listRes.rows,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * POST /api/customers
 */
export async function POST(req: Request) {
  const client = await pool.connect();

  try {
    const bodyUnknown = (await req.json()) as unknown;

    if (!bodyUnknown || typeof bodyUnknown !== "object") {
      return NextResponse.json(
        { ok: false, error: "body inválido" },
        { status: 400 }
      );
    }

    const body = bodyUnknown as Partial<CreateCustomerBody>;

    if (!isUuid(body.merchant_id)) {
      return NextResponse.json(
        { ok: false, error: "merchant_id inválido" },
        { status: 400 }
      );
    }

    if (body.branch_id !== undefined && body.branch_id !== null && !isUuid(body.branch_id)) {
      return NextResponse.json(
        { ok: false, error: "branch_id inválido" },
        { status: 400 }
      );
    }

    if (body.staff_id !== undefined && body.staff_id !== null && !isUuid(body.staff_id)) {
      return NextResponse.json(
        { ok: false, error: "staff_id inválido" },
        { status: 400 }
      );
    }

    if (!body.identifier || typeof body.identifier !== "object") {
      return NextResponse.json(
        { ok: false, error: "identifier requerido" },
        { status: 400 }
      );
    }

    const ident = body.identifier as { type?: unknown; value?: unknown };

    if (!isIdentifierType(ident.type)) {
      return NextResponse.json(
        { ok: false, error: "identifier.type inválido" },
        { status: 400 }
      );
    }

    if (typeof ident.value !== "string" || ident.value.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "identifier.value inválido" },
        { status: 400 }
      );
    }

    const merchant_id = body.merchant_id;
    const value_raw = ident.value;
    const value_normalized = normalizeIdentifier(ident.type, value_raw);

    await client.query("BEGIN");

    // 1) ¿Existe ya el identificador?
    const existingIdRes = await (client as unknown as PgClient).query<CustomerIdRow>(
      `
      SELECT customer_id
      FROM customer_identifiers
      WHERE type = $1 AND value_normalized = $2
      LIMIT 1
      `,
      [ident.type, value_normalized]
    );

    let customer_id: string;

    if (existingIdRes.rows.length > 0) {
      customer_id = existingIdRes.rows[0].customer_id;
    } else {
      // 2) crear customer
      const custRes = await (client as unknown as PgClient).query<CustomerInsertedRow>(
        `
        INSERT INTO customers DEFAULT VALUES
        RETURNING id
        `
      );
      customer_id = custRes.rows[0].id;

      // 3) crear identifier
      await client.query(
        `
        INSERT INTO customer_identifiers (
          customer_id,
          type,
          value_raw,
          value_normalized,
          is_primary
        )
        VALUES ($1,$2,$3,$4,true)
        `,
        [customer_id, ident.type, value_raw, value_normalized]
      );
    }

    // 4) asegurar membership
    let membership_created = false;

    if (!(await membershipExistsTx(client as unknown as PgClient, merchant_id, customer_id))) {
      await client.query(
        `
        INSERT INTO memberships (merchant_id, customer_id, status)
        VALUES ($1,$2,'active')
        `,
        [merchant_id, customer_id]
      );
      membership_created = true;
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      merchant_id,
      customer_id,
      branch_id: body.branch_id ?? null,
      staff_id: body.staff_id ?? null,
      identifier: {
        type: ident.type,
        value_raw,
        value_normalized,
      },
      membership_created,
    });
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}