import { z } from "zod";
import { EventTypeSchema } from "../contracts/event-types";

/**
 * Presence MVP:
 * - checkin  => "in"
 * - checkout => "out"
 * - visit/redeem => null (no afecta presencia)
 */
export const ComputeCustomerPresenceInputSchema = z.object({
  lastEventAt: z.coerce.date(), // hoy no lo usamos, pero lo dejamos para futuro
  lastEventType: EventTypeSchema,
});

export type ComputeCustomerPresenceInput = z.infer<
  typeof ComputeCustomerPresenceInputSchema
>;

export type CustomerPresence = "in" | "out" | null;

export function computeCustomerPresence(
  input: ComputeCustomerPresenceInput
): CustomerPresence {
  const { lastEventType } = input;

  if (lastEventType === "checkin") return "in";
  if (lastEventType === "checkout") return "out";

  // visit / redeem no cambian presencia (MVP)
  return null;
}