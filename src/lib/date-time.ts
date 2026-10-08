// Picker values are UTC ISO strings. Only the presentation uses IST.
const IST_OFFSET = 330 * 60_000;
const pad = (value: number) => String(value).padStart(2, "0");

export type DateTimeBounds = {
  minimumDate?: string;
  maximumDate?: string | "now";
  required?: boolean;
  minimumMessage?: string;
  maximumMessage?: string;
};

export function parseDateTime(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function indiaParts(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function indiaLocalValue(date: Date) {
  return new Date(date.getTime() + IST_OFFSET).toISOString().slice(0, 19);
}

export function parseIndiaLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? value + ":00" : value;
  const date = new Date(normalized + "+05:30");
  return Number.isFinite(date.getTime()) && indiaLocalValue(date) === normalized
    ? date
    : null;
}

export function formatDateTimeIST(value: string | null) {
  const date = parseDateTime(value);
  if (!date) return "Select date & time";
  const p = indiaParts(date);
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour % 12 || 12)}:${pad(p.minute)} ${p.hour >= 12 ? "PM" : "AM"}`;
}

export function resolveDateTimeBounds(
  bounds: DateTimeBounds,
  now = Date.now(),
) {
  return {
    minimum: bounds.minimumDate ? parseDateTime(bounds.minimumDate) : null,
    maximum:
      bounds.maximumDate === "now"
        ? new Date(now)
        : parseDateTime(bounds.maximumDate),
  };
}

export function validateDateTime(
  value: string | null,
  bounds: DateTimeBounds = {},
  now = Date.now(),
): string | null {
  const { minimum, maximum } = resolveDateTimeBounds(bounds, now);
  if (
    (bounds.minimumDate && !minimum) ||
    (bounds.maximumDate && !maximum) ||
    (minimum && maximum && minimum.getTime() > maximum.getTime())
  )
    return "The date/time limits are unavailable or invalid. Refresh and try again.";
  if (!value) return bounds.required ? "Choose a date and time." : null;
  const date = parseDateTime(value);
  if (!date) return "Choose a valid date and time.";
  if (minimum && date.getTime() < minimum.getTime())
    return (
      bounds.minimumMessage ||
      `Choose a time on or after ${formatDateTimeIST(minimum.toISOString())} IST.`
    );
  if (maximum && date.getTime() > maximum.getTime())
    return (
      bounds.maximumMessage ||
      (bounds.maximumDate === "now"
        ? "Choose a time no later than the current time."
        : `Choose a time on or before ${formatDateTimeIST(maximum.toISOString())} IST.`)
    );
  return null;
}

export function clampDateTime(
  date: Date,
  bounds: DateTimeBounds,
  now = Date.now(),
) {
  const { minimum, maximum } = resolveDateTimeBounds(bounds, now);
  return new Date(
    Math.max(
      minimum?.getTime() ?? -Infinity,
      Math.min(maximum?.getTime() ?? Infinity, date.getTime()),
    ),
  );
}

export function mergeIndiaSelection(
  current: Date,
  selected: Date,
  mode: "date" | "time" | "datetime",
) {
  if (mode === "datetime") return selected;
  const day = indiaParts(mode === "date" ? selected : current);
  const clock = indiaParts(mode === "time" ? selected : current);
  return new Date(
    Date.UTC(day.year, day.month - 1, day.day, clock.hour, clock.minute) -
      IST_OFFSET,
  );
}
