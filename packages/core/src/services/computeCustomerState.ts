import { computeCustomerStatus } from "./computeCustomerStatus";
import { computeCustomerPresence } from "./computeCustomerPresence";
import { EventType } from "../contracts/event-types";

export type ComputeCustomerStateInput = {
  totalEvents: number;
  lastEventAt: Date | null;
  lastEventType: EventType | null;
};

export type ComputeCustomerStateOutput = {
  total_events: number;
  last_event_type: EventType | null;
  last_event_at: Date | null;
  customer_status: string | null;
  customer_presence: "in" | "out" | null;
};

/**
 * Customer State Engine (MVP)
 * Única fuente de verdad sobre el estado del cliente
 */
export function computeCustomerState(
  input: ComputeCustomerStateInput
): ComputeCustomerStateOutput {
  const { totalEvents, lastEventAt, lastEventType } = input;

  const customerStatus =
    lastEventAt && totalEvents > 0
      ? computeCustomerStatus({ lastEventAt, totalEvents })
      : null;

  const customerPresence =
    lastEventAt && lastEventType
      ? computeCustomerPresence({ lastEventAt, lastEventType })
      : null;

  return {
    total_events: totalEvents,
    last_event_type: lastEventType,
    last_event_at: lastEventAt,
    customer_status: customerStatus,
    customer_presence: customerPresence,
  };
}
