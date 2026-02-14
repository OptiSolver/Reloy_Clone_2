import { db, rewards, rewardRedemptions, events, eq, and } from "@loop/db";
import { RedeemInput } from "../contracts/redeem"; // Asegurarse de que este tipo existe y es correcto
import { addPointsLedgerEntry, getPointsBalance } from "./ledger";

export async function redeemReward(input: RedeemInput) {
  const { merchantId, branchId, customerId, staffId, rewardId } = input;

  return await db.transaction(async (tx) => {
    // 1. Obtener Reward y Validar
    const reward = await tx.query.rewards.findFirst({
      where: and(eq(rewards.id, rewardId), eq(rewards.merchantId, merchantId)),
    });

    if (!reward) throw new Error("reward_not_found");
    if (!reward.isActive) throw new Error("reward_inactive");

    // 2. Verificar Balance (usando snapshot de memberships para rapidez, o ledger si se prefiere strict)
    // Para seguridad transaccional fuerte, podríamos bloquear el registro de membership,
    // pero por ahora checkeamos el snapshot que se actualiza atómicamente en ledger.ts
    const currentBalance = await getPointsBalance(merchantId, customerId);

    if (currentBalance < reward.pointsCost) {
      const err: any = new Error("insufficient_points");
      err.balance = currentBalance;
      err.required = reward.pointsCost;
      throw err;
    }

    // 3. Crear Redemption Record
    const [redemption] = await tx
      .insert(rewardRedemptions)
      .values({
        merchantId,
        rewardId,
        customerId,
        staffId: staffId ?? null,
        branchId: branchId ?? null,
        pointsSpent: reward.pointsCost,
        status: "approved",
      })
      .returning();

    // 4. Crear Evento 'redeem'
    const [event] = await tx
      .insert(events)
      .values({
        merchantId,
        branchId: branchId ?? null,
        customerId,
        staffId: staffId ?? null,
        type: "redeem",
        payload: { reward_id: rewardId, redemption_id: redemption.id },
      })
      .returning();

    // 5. Descontar Puntos en Ledger (Delta negativo)
    // Esto también actualiza el balance en memberships
    await addPointsLedgerEntry(
      merchantId,
      customerId,
      -reward.pointsCost,
      event.id,
      "redeem_reward"
    );

    return { redemption, event };
  });
}