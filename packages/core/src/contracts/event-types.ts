import { z } from "zod";

/**
 * Tipos de evento MVP
 */
export const EventTypeSchema = z.enum(["visit", "checkin", "checkout", "redeem"]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Payload por tipo de evento (MVP)
 * - visit/checkin/checkout: objeto libre (pero tiene que ser objeto)
 * - redeem: requiere reward_id
 *
 * Nota: usamos object({}).catchall(...) en vez de z.record
 * para evitar problemas de typings y mantener "objeto libre".
 */
const FreeObjectPayloadSchema = z.object({}).catchall(z.unknown());

const RedeemPayloadSchema = z.object({
  reward_id: z.string().uuid(),
});

export const PayloadByType = {
  visit: FreeObjectPayloadSchema,
  checkin: FreeObjectPayloadSchema,
  checkout: FreeObjectPayloadSchema,
  redeem: RedeemPayloadSchema,
} as const;