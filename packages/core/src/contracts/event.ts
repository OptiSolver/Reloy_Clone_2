import { z } from "zod";

/**
 * Tipos de evento MVP (después los ampliamos)
 * - visit: visita única (rubros "single")
 * - checkin / checkout: rubros "in_out"
 * - redeem: canje
 */
export const EventTypeSchema = z.enum(["visit", "checkin", "checkout", "redeem"]);
export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * Payload por tipo de evento (MVP)
 * - visit/checkin/checkout: por ahora aceptamos objeto libre
 * - redeem: requiere reward_id
 */
const VisitPayloadSchema = z.record(z.string(), z.unknown()); // flexible por ahora
const CheckInPayloadSchema = z.record(z.string(), z.unknown());
const CheckOutPayloadSchema = z.record(z.string(), z.unknown());
const RedeemPayloadSchema = z.object({
  reward_id: z.string().uuid(),
});

export const PayloadByType = {
  visit: VisitPayloadSchema,
  checkin: CheckInPayloadSchema,
  checkout: CheckOutPayloadSchema,
  redeem: RedeemPayloadSchema,
} as const;

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