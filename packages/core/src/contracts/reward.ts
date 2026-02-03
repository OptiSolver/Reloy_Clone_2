import { z } from "zod";

/**
 * Reward (según schema.ts actual)
 */
export const RewardSchema = z.object({
  id: z.string().uuid(),
  merchantId: z.string().uuid(),

  title: z.string().min(1),
  description: z.string().nullable().optional(),

  pointsCost: z.number().int().nonnegative(),
  isActive: z.boolean(),

  meta: z.record(z.string(), z.unknown()),

  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type Reward = z.infer<typeof RewardSchema>;

/**
 * Input para crear reward (MVP)
 */
export const CreateRewardInputSchema = z.object({
  merchantId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  pointsCost: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type CreateRewardInput = z.infer<typeof CreateRewardInputSchema>;