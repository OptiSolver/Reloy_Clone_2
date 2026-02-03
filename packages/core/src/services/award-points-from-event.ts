import { pool } from "@loop/db";
import { EventType } from "../contracts/event-types";

export type AwardPointsFromEventInput = {
  eventId: string;
  merchantId: string;
  customerId: string;
  branchId?: string | null;
  staffId?: string | null;
  type: EventType;
  payload?: unknown;
};

function computeEarnDelta(type: EventType): { delta: number; reason: string } | null {
  // MVP rules
  if (type === "visit") return { delta: 10, reason: "earn_visit" };
  if (type === "checkin") return { delta: 20, reason: "earn_checkin" };
  return null;
}

/**
 * Inserta un movimiento en points_ledger basado en un event.
 * Idempotente por source_event_id + reason (si ya existe, no inserta de nuevo).
 */
export async function awardPointsFromEvent(input: AwardPointsFromEventInput) {
  const earn = computeEarnDelta(input.type);
  if (!earn) return { inserted: false };

  // Idempotencia: si ya existe un ledger para este event+reason => no duplicar
  const exists = await pool.query(
    `
    SELECT 1
    FROM points_ledger
    WHERE source_event_id = $1 AND reason = $2
    LIMIT 1
    `,
    [input.eventId, earn.reason]
  );

  if (exists.rowCount && exists.rowCount > 0) {
    return { inserted: false };
  }

  const meta = {
    rule: earn.reason,
    event_type: input.type,
    payload: input.payload ?? null,
  };

  const res = await pool.query(
    `
    INSERT INTO points_ledger (
      merchant_id,
      customer_id,
      branch_id,
      staff_id,
      source_event_id,
      delta_points,
      reason,
      meta
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    RETURNING *
    `,
    [
      input.merchantId,
      input.customerId,
      input.branchId ?? null,
      input.staffId ?? null,
      input.eventId,
      earn.delta,
      earn.reason,
      JSON.stringify(meta),
    ]
  );

  return { inserted: true, ledger: res.rows[0] };
}
