/**
 * Presencia del cliente (MVP)
 * - "in": si el último evento es checkin
 * - "out": si el último evento es checkout o visit/redeem
 *
 * Nota: en rubros "single" (visit) no tiene sentido presencia in/out,
 * pero devolvemos "out" por default.
 */
export type CustomerPresence = "in" | "out";

export type ComputeCustomerPresenceInput = {
  lastEventType?: string | null;
};

export function computeCustomerPresence(
  input: ComputeCustomerPresenceInput
): CustomerPresence {
  const t = (input.lastEventType ?? "").toLowerCase();

  if (t === "checkin") return "in";
  if (t === "checkout") return "out";

  // para visit/redeem u otros eventos, asumimos que no queda "adentro"
  return "out";
}