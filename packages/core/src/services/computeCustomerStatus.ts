export type CustomerStatus = "new" | "active" | "risk" | "lost";

type ComputeCustomerStatusInput = {
  lastEventAt: Date | null;
  totalEvents: number;
  now?: Date;
};

export function computeCustomerStatus(
  input: ComputeCustomerStatusInput
): CustomerStatus {
  const now = input.now ?? new Date();

  // Sin eventos → nuevo
  if (!input.lastEventAt || input.totalEvents === 0) {
    return "new";
  }

  const diffMs = now.getTime() - input.lastEventAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 30) return "active";
  if (diffDays <= 90) return "risk";

  return "lost";
}