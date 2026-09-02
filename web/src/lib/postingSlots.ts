import type { PostingSlot } from '@shared/types';

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The earliest recurring slot that's in the future and not already occupied by
 * another scheduled post. Times are read in the operator's local zone — good
 * enough while the operator works in the campaign's zone; revisit if that
 * stops holding.
 */
export function nextOpenSlot(
  slots: PostingSlot[],
  taken: Date[],
  from: Date = new Date(),
): Date | null {
  if (!slots.length) return null;
  const takenMs = taken.map((d) => d.getTime());
  const free = (d: Date) => !takenMs.some((t) => Math.abs(t - d.getTime()) < 45 * 60 * 1000);

  for (let i = 0; i < 60; i++) {
    const day = new Date(from);
    day.setDate(from.getDate() + i);
    const candidates = slots
      .filter((s) => s.dow === day.getDay())
      .map((s) => {
        const [h, m] = s.time.split(':').map(Number);
        const d = new Date(day);
        d.setHours(h ?? 9, m ?? 0, 0, 0);
        return d;
      })
      .sort((a, b) => a.getTime() - b.getTime());
    for (const d of candidates) {
      if (d.getTime() > from.getTime() + 5 * 60 * 1000 && free(d)) return d;
    }
  }
  return null;
}
