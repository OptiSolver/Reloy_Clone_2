import { z } from "zod";

export const EventTypeSchema = z.enum(["visit", "checkin", "checkout", "redeem"]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * CreateEventInput
 * - Acepta snake_case y camelCase
 * - Normaliza a snake_case para el core
 */
export const CreateEventInputSchema = z
  .object({
    type: EventTypeSchema,

    // snake_case (DB / interno)
    merchant_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().nullable().optional(),
    customer_id: z.string().uuid().optional(),
    staff_id: z.string().uuid().nullable().optional(),

    // camelCase (UI / cliente)
    merchantId: z.string().uuid().optional(),
    branchId: z.string().uuid().nullable().optional(),
    customerId: z.string().uuid().optional(),
    staffId: z.string().uuid().nullable().optional(),

    payload: z.unknown().optional(),
  })
  .transform((v) => ({
    type: v.type,
    merchant_id: v.merchant_id ?? v.merchantId!,
    branch_id: v.branch_id ?? v.branchId ?? null,
    customer_id: v.customer_id ?? v.customerId!,
    staff_id: v.staff_id ?? v.staffId ?? null,
    payload: v.payload ?? null,
  }));

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;