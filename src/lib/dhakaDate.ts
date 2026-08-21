// This store is Bangladesh-only (docs/architecture.md) — "today" and daily
// buckets should always mean a Dhaka calendar day, regardless of where the
// server process actually runs. Using the server's local timezone would be
// wrong the moment this deploys somewhere that isn't already on Dhaka time
// (e.g. a UTC serverless function), and mixing server-local Date math with
// UTC-based date-string grouping produced a real day-off-by-one bug in
// testing (the "today" column of the trend chart didn't match the
// browser's own idea of today). Bangladesh doesn't observe DST, so a fixed
// +6:00 offset is safe to hardcode rather than needing a timezone library.
export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
export const DHAKA_TIMEZONE = "Asia/Dhaka";

export function dhakaDateKey(date: Date): string {
  return new Date(date.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

// Midnight at the start of `date`'s Dhaka calendar day, expressed as the
// true UTC instant that moment falls on (what Mongo actually compares
// createdAt against).
export function startOfDhakaDay(date: Date): Date {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - DHAKA_OFFSET_MS);
}
