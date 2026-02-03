import { computeCustomerStatus } from "./computeCustomerStatus";
import { computeCustomerPresence } from "./computeCustomerPresence";
import { EventType } from "../contracts/event-types";

export type ComputeCustomerStateInput = {
  totalEvents: number;
  lastEventAt: Date | null;
  lastEventType: EventType | null;

  /**
   * Opcional: último evento relevante SOLO para presencia
   * (ej: checkin/checkout) para que redeem/visit no rompan presence.
   */
  lastPresenceEventAt?: Date | null;
  lastPresenceEventType?: EventType | null;
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
  const {
    totalEvents,
    lastEventAt,
    lastEventType,
    lastPresenceEventAt,
    lastPresenceEventType,
  } = input;

  // Status: usa actividad general (cualquier evento)
  const customerStatus =
    lastEventAt && totalEvents > 0
      ? computeCustomerStatus({ lastEventAt, totalEvents })
      : null;

  // Presence: usa checkin/checkout si existe, sino cae al último evento
  const effectivePresenceAt = lastPresenceEventAt ?? lastEventAt;
  const effectivePresenceType = lastPresenceEventType ?? lastEventType;

  const customerPresence =
    effectivePresenceAt && effectivePresenceType
      ? computeCustomerPresence({
          lastEventAt: effectivePresenceAt,
          lastEventType: effectivePresenceType,
        })
      : null;

  return {
    total_events: totalEvents,
    last_event_type: lastEventType,
    last_event_at: lastEventAt,
    customer_status: customerStatus,
    customer_presence: customerPresence,
  };
}
