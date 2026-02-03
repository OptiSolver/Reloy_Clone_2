import { db, events } from "@loop/db";

type CreateEventInput = {
  merchantId: string;
  branchId?: string | null;
  customerId: string;
  staffId?: string | null;
  type: "visit"; // por ahora solo 'visit' (MVP)
  payload: Record<string, unknown>;
};

export async function createEvent(input: CreateEventInput) {
  const [row] = await db
    .insert(events)
    .values({
      merchantId: input.merchantId,
      branchId: input.branchId ?? null,
      customerId: input.customerId,
      staffId: input.staffId ?? null,
      type: input.type,
      payload: input.payload,
    })
    .returning({ id: events.id });

  return { id: row.id };
}