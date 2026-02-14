import { db, pointsLedger, memberships, eq, sql } from "@loop/db";

/**
 * Agrega un movimiento al ledger de puntos y actualiza el balance del usuario.
 * Es transaccional y atómico.
 */
export async function addPointsLedgerEntry(
    merchantId: string,
    customerId: string,
    delta: number,
    sourceEventId: string,
    reason: string
) {
    return await db.transaction(async (tx) => {
        // 1. Insertar en Points Ledger
        // Si sourceEventId ya existe, fallará por unique index (idempotencia)
        const [entry] = await tx
            .insert(pointsLedger)
            .values({
                merchantId,
                customerId,
                delta,
                sourceEventId,
                reason,
            })
            .returning();

        // 2. Actualizar balance en Membership (Snapshot)
        // Usamos sql para incremento atómico: balance = balance + delta
        const [updatedMembership] = await tx
            .update(memberships)
            .set({
                pointsBalance: sql`${memberships.pointsBalance} + ${delta}`,
                updatedAt: new Date(),
            })
            .where(
                eq(memberships.merchantId, merchantId) &&
                eq(memberships.customerId, customerId)
            )
            .returning();

        return { entry, newBalance: updatedMembership?.pointsBalance ?? 0 };
    });
}

/**
 * Obtiene el balance actual (snapshot) de un cliente en un comercio.
 */
export async function getPointsBalance(merchantId: string, customerId: string) {
    const result = await db.query.memberships.findFirst({
        where: (memberships, { eq, and }) =>
            and(eq(memberships.merchantId, merchantId), eq(memberships.customerId, customerId)),
        columns: {
            pointsBalance: true,
        },
    });

    return result?.pointsBalance ?? 0;
}
