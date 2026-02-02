import { z } from "zod";

/**
 * ================================
 * TIPOS DE EVENTOS (MVP)
 * ================================
 * Regla: el type define cómo debe ser el payload.
 */
export const EventTypeSchema = z.enum([
  "visit",        // rubros sin in/out
  "check_in",     // entrada
  "check_out",    // salida
  "redeem",       // canje de recompensa
  "review",       // reseña (Google u otros)
  "rating",       // calificación interna
  "points_adjust" // ajuste manual (admin / soporte)
]);

export type EventType = z.infer<typeof EventTypeSchema>;

/**
 * ================================
 * PAYLOADS POR TIPO DE EVENTO
 * ================================
 */
const PayloadByType = {
  visit: z.object({
    points: z.number().int().min(0).default(0),
    note: z.string().max(280).optional()
  }),

  check_in: z.object({
    note: z.string().max(280).optional()
  }),

  check_out: z.object({
    points: z.number().int().min(0).default(0),
    duration_sec: z.number().int().min(0).optional(),
    note: z.string().max(280).optional()
  }),

  redeem: z.object({
    reward_id: z.string().uuid(),
    points_spent: z.number().int().min(1)
  }),

  review: z.object({
    provider: z.enum(["google", "other"]).default("google"),
    url: z.string().url().optional()
  }),

  rating: z.object({
    stars: z.number().int().min(1).max(5),
    note: z.string().max(280).optional()
  }),

  points_adjust: z.object({
    delta_points: z.number().int(),
    reason: z.string().min(1).max(280)
  })
} as const;

/**
 * ================================
 * INPUT PARA CREAR EVENTO
 * (Staff App → Backend)
 * ================================
 */
export const CreateEventInputSchema = z.object({
  merchant_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  type: EventTypeSchema,
  payload: z.unknown()
}).superRefine((data, ctx) => {
  const schema =
    PayloadByType[data.type as keyof typeof PayloadByType];

  const result = schema.safeParse(data.payload);

  if (!result.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Payload inválido para el tipo de evento: ${data.type}`,
      path: ["payload"]
    });
  }
});

export type CreateEventInput = z.infer<
  typeof CreateEventInputSchema
>;