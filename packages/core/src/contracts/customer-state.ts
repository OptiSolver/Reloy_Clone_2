import type { CustomerStatus } from "../services/computeCustomerStatus";
import type { CustomerPresence } from "../services/computeCustomerPresence";
import type { EventType } from "./event-types";

export type CustomerState = {
  merchant_id: string;
  customer_id: string;
  branch_id: string | null;

  total_events: number;

  last_event_type: EventType | null;
  last_event_at: Date | null;

  customer_status: CustomerStatus | null;
  customer_presence: CustomerPresence | null;
};