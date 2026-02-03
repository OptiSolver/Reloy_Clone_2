import { pool } from "@loop/db";
import { CreateEventInput } from "../contracts/event";

export type EventRow = {
  id: string;
  merchant_id: string;
  branch_id: string | null;
  customer_id: string;
  staff_id: string | null;
  type: string;
  payload: unknown;
  occurred_at: string;
  created_at: string;
};

export async function createEvent(input: CreateEventInput): Promise<EventRow> {
  const { merchant_id, branch_id, customer_id, type, payload } = input;

  const result = await pool.query<EventRow>(
    `
    INSERT INTO events (
      merchant_id,
      branch_id,
      customer_id,
      type,
      payload
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [merchant_id, branch_id, customer_id, type, payload]
  );

  return result.rows[0];
}