import { z } from "zod";

export const EventsQuerySchema = z.object({
  merchant_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  limit: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50),
});

export type EventsQuery = z.infer<typeof EventsQuerySchema>;