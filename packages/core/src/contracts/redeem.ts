import { z } from "zod";

export const RedeemInputSchema = z.object({
  merchantId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  staffId: z.string().uuid().optional(),

  rewardId: z.string().uuid(),
});

export type RedeemInput = z.infer<typeof RedeemInputSchema>;
