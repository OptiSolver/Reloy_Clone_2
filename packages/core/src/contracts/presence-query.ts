import { z } from "zod";

/**
 * Query para endpoint de presencia (in/out)
 */
export const PresenceQuerySchema = z.object({
  merchant_id: z.string().uuid(),
  customer_id: z.string().uuid(),
});

export type PresenceQuery = z.infer<typeof PresenceQuerySchema>;
