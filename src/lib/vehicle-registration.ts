// Format checks only: registration ownership and vehicle class require RC/VAHAN data.
// Retain older state codes because vehicles keep their original registration marks.
const stateCodes = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ",
  "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
  "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "TG",
  "UK", "UP", "UA", "WB",
]);

export function normalizeVehicleNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]+/g, "");
}

export function getVehicleNumberError(value: string, now = new Date()): string | null {
  const number = normalizeVehicleNumber(value);
  if (!number) return "Enter the vehicle registration number.";

  const bh = /^(\d{2})BH(\d{4})([A-HJ-NP-Z]{1,2})$/.exec(number);
  if (bh) {
    const currentYear = new Date(now.getTime() + 330 * 60000).getUTCFullYear() % 100;
    if (Number(bh[1]) >= 21 && Number(bh[1]) <= currentYear && Number(bh[2]) > 0) return null;
  }

  // One-digit authority codes and three-letter series accommodate Delhi registrations.
  const regular = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/.exec(number);
  if (regular && stateCodes.has(regular[1]) && Number(regular[2]) > 0 && Number(regular[4]) > 0) return null;

  // Older registrations can have no alphabetic series, for example MH 12 1234.
  const older = /^([A-Z]{2})(\d{2})(\d{4})$/.exec(number);
  if (older && stateCodes.has(older[1]) && Number(older[2]) > 0 && Number(older[3]) > 0) return null;

  return "Check the registration number on the vehicle. Examples: MH12AB1234, DL1CAA1234 or 26BH1234AA.";
}
