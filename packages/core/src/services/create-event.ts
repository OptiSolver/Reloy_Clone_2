import { db, events } from "@loop/db";
import { CreateEventInput } from "../contracts/event";

export async function createEvent(input: CreateEventInput) {
  const {
    merchant_id,
    branch_id,
    customer_id,
    type,
    payload,
  } = input;

  console.log("[core:createEvent] inserting event", {
    merchant_id,
    branch_id,
    customer_id,
    type,
    payload,
  });

  const [event] = await db
    .insert(events)
    .values({
      merchantId: merchant_id,
      branchId: branch_id,
      customerId: customer_id,
      type,
      payload,
    })
    .returning();

  return event;
}