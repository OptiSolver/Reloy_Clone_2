export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { redeemReward } from "@loop/core";
import { db } from "@loop/db"; // Para resolver staff context si es necesario

// Helpers para auth
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
 * POST /api/redeem
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;

    // Normalizar snake_case a camelCase inicial
    let merchantId = body.merchantId ?? body.merchant_id;
    let branchId = body.branchId ?? body.branch_id;
    let staffId = body.staffId ?? body.staff_id;
    let customerId = body.customerId ?? body.customer_id;
    let rewardId = body.rewardId ?? body.reward_id;

    // 1) Autocomplete context desde Header
    const auth_user_id = getDevAuthUserId(req);
    if (auth_user_id) {
      // Si falta contexto, lo buscamos
      if (!merchantId || !branchId || !staffId) {
        const ctx = await getStaffContextByAuthUserId(auth_user_id);
        if (!ctx) {
          return NextResponse.json({ ok: false, error: "staff_context_not_found" }, { status: 401 });
        }
        merchantId = merchantId ?? ctx.merchant_id;
        branchId = branchId ?? ctx.branch_id;
        staffId = staffId ?? ctx.staff_id;
      }
    }

    if (!merchantId) return NextResponse.json({ ok: false, error: "merchantId_required" }, { status: 400 });
    if (!customerId) return NextResponse.json({ ok: false, error: "customerId_required" }, { status: 400 });
    if (!rewardId) return NextResponse.json({ ok: false, error: "rewardId_required" }, { status: 400 });

    // 2) Llamar al servicio core (que maneja transacción, validación y ledger)
    const result = await redeemReward({
      merchantId,
      customerId,
      rewardId,
      branchId,
      staffId
    });

    return NextResponse.json({
      ok: true,
      redemption: result.redemption,
      event: result.event
    });

  } catch (error: any) {
    // Manejo de errores conocidos del servicio
    const msg = error.message;
    let status = 500;

    if (msg === "reward_not_found") status = 404;
    else if (msg === "reward_inactive") status = 400;
    else if (msg === "insufficient_points") status = 400; // Podría ser 402 payment required?
    else if (msg === "already_redeemed") status = 409;

    // Si viene error con datos extra (ej: balance)
    return NextResponse.json({
      ok: false,
      error: msg,
      balance: error.balance,
      required: error.required
    }, { status });
  }
}