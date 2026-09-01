export const NETWORK_LABEL: Record<string, string> = {
  bluesky: 'Bluesky',
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const CHAR_LIMIT: Record<string, number> = {
  bluesky: 300,
  threads: 500,
  instagram: 2200,
  facebook: 63206,
  tiktok: 2200,
  youtube: 5000,
};

export function charLimit(network: string): number | undefined {
  return CHAR_LIMIT[network];
}

/** "Aug 14, 9:00 AM" — short, no year when it's this year. */
export function shortWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
