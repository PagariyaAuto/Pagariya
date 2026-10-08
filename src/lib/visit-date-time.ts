import { parseDateTime, validateDateTime, type DateTimeBounds } from "./date-time";

export const GATE_IN_UNAVAILABLE = "The vehicle's Gate In time could not be loaded. Refresh and try again.";

/** Each action is independently bounded by the exact visit's Gate In. */
export function visitDateTimeBounds(gateInAt: string | null): DateTimeBounds {
  const gate = parseDateTime(gateInAt);
  return {
    // Fail closed while loading; never silently allow dates before Gate In.
    minimumDate: gate ? gate.toISOString() : "unavailable",
    maximumDate: "now",
    required: true,
    minimumMessage: "Choose a date and time on or after this vehicle's Gate In.",
  };
}

export function validateVisitDateTime(value: string | null, gateInAt: string | null): string | null {
  const gate = parseDateTime(gateInAt);
  if (!gate || gate.getTime() > Date.now()) return GATE_IN_UNAVAILABLE;
  return validateDateTime(value, visitDateTimeBounds(gateInAt));
}
