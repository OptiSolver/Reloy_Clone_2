import { z } from "zod";
import { EventTypeSchema, PayloadByType } from "./event-types";

/**
 * Input de creación de evento
 * Acepta snake_case o camelCase y normaliza a snake_case.
 */
export const CreateEventInputSchema = z
  .object({
    // snake_case
    merchant_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    customer_id: z.string().uuid().optional(),

    // camelCase
    merchantId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),

    type: EventTypeSchema,
    payload: z.unknown(),
  })
  .superRefine((data, ctx) => {
    const merchant_id = data.merchant_id ?? data.merchantId;
    const branch_id = data.branch_id ?? data.branchId;
    const customer_id = data.customer_id ?? data.customerId;

    if (!merchant_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "merchant_id es requerido",
        path: ["merchant_id"],
      });
    }

    if (!branch_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "branch_id es requerido",
        path: ["branch_id"],
      });
    }

    if (!customer_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customer_id es requerido",
        path: ["customer_id"],
      });
    }

    const payloadSchema = PayloadByType[data.type];
    const result = payloadSchema.safeParse(data.payload);

    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Payload inválido para el tipo de evento: ${data.type}`,
        path: ["payload"],
      });
    }
  })
  .transform((data) => ({
    merchant_id: data.merchant_id ?? data.merchantId!,
    branch_id: data.branch_id ?? data.branchId!,
    customer_id: data.customer_id ?? data.customerId!,
    type: data.type,
    payload: data.payload,
  }));

export type CreateEventInput = z.infer<typeof CreateEventInputSchema>;