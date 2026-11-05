/** IMEI checks mirrored from backend/app/services/imei.py (15 digits + Luhn). */

export function normalizeImei(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function luhnOk(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false;
  let total = 0;
  for (let i = 0; i < imei.length; i++) {
    let n = Number(imei[imei.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    total += n;
  }
  return total % 10 === 0;
}

/** Return an error message, or null when the IMEI looks valid. */
export function imeiError(imei: string): string | null {
  if (!imei) return "IMEI is blank";
  if (imei.length !== 15) return `IMEI must be 15 digits (got ${imei.length})`;
  if (!luhnOk(imei)) return "IMEI failed Luhn check";
  return null;
}
