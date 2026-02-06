export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@loop/db";

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * DEV AUTH:
 * - header x-auth-user-id (prioridad)
 * - cookie dev_auth_user_id (fallback)
 */
async function getDevAuthUserId(req: Request): Promise<string | null> {
  const h =
    req.headers.get("x-auth-user-id") ||
    req.headers.get("X-Auth-User-Id") ||
    null;

  if (h && isUuid(h)) return h;

  const cookieStore = await cookies();
  const c = cookieStore.get("dev_auth_user_id")?.value ?? null;

  if (c && isUuid(c)) return c;

  return null;
}

type OwnerRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  account_type: string | null;
  status: string | null;
};

type MerchantRow = {
  id: string;
  owner_id: string;
  name: string;
  is_active: boolean;
};

type BranchRow = {
  id: string;
  merchant_id: string;
  name: string;
};

type StaffRow = {
  id: string;
  branch_id: string;
  full_name: string;
  role: string;
  auth_user_id: string | null;
  is_active: boolean;
  created_at: string;
};

export async function GET(req: Request) {
  const auth_user_id = await getDevAuthUserId(req);

  if (!auth_user_id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "missing_dev_auth_user_id (en dev mandá header x-auth-user-id: <uuid> o cookie dev_auth_user_id)",
      },
      { status: 401 }
    );
  }

  const client = await pool.connect();
  try {
    // 1) Owner por auth_user_id
    const ownerRes = await client.query<OwnerRow>(
      `
      select id, auth_user_id, first_name, last_name, account_type, status
      from owners
      where auth_user_id = $1
      limit 1
      `,
      [auth_user_id]
    );

    const owner = ownerRes.rows?.[0] ?? null;

    if (!owner) {
      return NextResponse.json(
        { ok: false, error: "owner_not_found_for_auth_user_id", auth_user_id },
        { status: 404 }
      );
    }

    // 2) Merchants del owner
    const merchantsRes = await client.query<MerchantRow>(
      `
      select id, owner_id, name, is_active
      from merchants
      where owner_id = $1
      order by name asc
      `,
      [owner.id]
    );

    const merchants = merchantsRes.rows ?? [];
    const merchantIds = merchants.map((m) => m.id);

    // 3) Branches de esos merchants
    const branches =
      merchantIds.length === 0
        ? []
        : (
            await client.query<BranchRow>(
              `
              select id, merchant_id, name
              from branches
              where merchant_id = any($1::uuid[])
              order by name asc
              `,
              [merchantIds]
            )
          ).rows ?? [];

    const branchIds = branches.map((b) => b.id);

    // 4) Staff de esas branches
    const staff =
      branchIds.length === 0
        ? []
        : (
            await client.query<StaffRow>(
              `
              select id, branch_id, full_name, role, auth_user_id, is_active, created_at
              from staff
              where branch_id = any($1::uuid[])
              order by created_at desc
              `,
              [branchIds]
            )
          ).rows ?? [];

    // 5) Defaults
    const default_merchant_id = merchants[0]?.id ?? null;
    const default_branch_id =
      default_merchant_id
        ? branches.find((b) => b.merchant_id === default_merchant_id)?.id ?? null
        : null;

    return NextResponse.json({
      ok: true,
      auth_user_id,
      owner,
      merchants,
      branches,
      staff,
      defaults: {
        merchant_id: default_merchant_id,
        branch_id: default_branch_id,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}