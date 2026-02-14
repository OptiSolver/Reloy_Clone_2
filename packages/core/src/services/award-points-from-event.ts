import { EventType } from "../contracts/event-types";
import { addPointsLedgerEntry } from "./ledger";

export type AwardPointsFromEventInput = {
  eventId: string;
  merchantId: string;
  customerId: string;
  branchId?: string | null;
  staffId?: string | null;
  type: EventType;
  payload?: unknown;
};

// Configuración simple de puntos por evento (esto podría venir de merchant_settings/missions en el futuro)
function computeEarnDelta(type: EventType): { delta: number; reason: string } | null {
  if (type === "visit") return { delta: 10, reason: "earn_visit" };
  if (type === "checkin") return { delta: 5, reason: "earn_checkin" };
  // Otros tipos no dan puntos por defecto en esta versión base
  return null;
}

/**
 * Procesa un evento y otorga puntos si corresponde, registrándolo en el ledger.
 */
export async function awardPointsFromEvent(input: AwardPointsFromEventInput) {
  const earn = computeEarnDelta(input.type);

  if (!earn) {
    return { awarded: false, reason: "no_rules_match" };
  }

  try {
    const result = await addPointsLedgerEntry(
      input.merchantId,
      input.customerId,
      earn.delta,
      input.eventId,
      earn.reason
    );

    return {
      awarded: true,
      delta: earn.delta,
      newBalance: result.newBalance,
      ledgerId: result.entry.id
    };
  } catch (error: any) {
    // Si falla por unique constraint del sourceEventId, es idempotencia
    // Código de error Postgres para unique violation es '23505'
    if (error.code === '23505') {
      return { awarded: false, reason: "already_processed" };
    }
    throw error;
  }
}
