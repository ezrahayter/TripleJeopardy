import { Bookmark, Eye, Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Metrics = Record<string, number>;

const ENGAGEMENT_KEYS = ['likes', 'comments', 'shares', 'reposts', 'replies', 'quotes'] as const;

export function engagementOf(m: Metrics): number {
  return ENGAGEMENT_KEYS.reduce((sum, k) => sum + (m[k] ?? 0), 0);
}
export function reachOf(m: Metrics): number {
  return m.reach ?? m.impressions ?? m.views ?? 0;
}
export function hasAnyMetrics(m: Metrics | null | undefined): boolean {
  return !!m && Object.values(m).some((v) => v > 0);
}

export function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Likes · comments/replies · shares/reposts · reach · saves — collapsed to
 *  what the network reports, with network-aware labels. */
export function PostMetricsBar({
  metrics,
  network,
  size = 'sm',
  className,
}: {
  metrics: Metrics;
  network?: string;
  size?: 'sm' | 'xs';
  className?: string;
}) {
  const likes = metrics.likes ?? 0;
  const comments = (metrics.comments ?? 0) + (metrics.replies ?? 0);
  const shares = (metrics.shares ?? 0) + (metrics.reposts ?? 0) + (metrics.quotes ?? 0);
  const reach = reachOf(metrics);
  const saves = metrics.saves ?? 0;

  const items = [
    { icon: Heart, n: likes, title: 'Likes' },
    { icon: MessageCircle, n: comments, title: network === 'bluesky' ? 'Replies' : 'Comments' },
    { icon: Repeat2, n: shares, title: network === 'bluesky' ? 'Reposts' : 'Shares' },
    ...(saves > 0 ? [{ icon: Bookmark, n: saves, title: 'Saves' }] : []),
    ...(reach > 0 ? [{ icon: Eye, n: reach, title: 'Reach' }] : []),
  ];

  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums text-muted-foreground',
        size === 'xs' ? 'text-[11px]' : 'text-xs',
        className,
      )}
    >
      {items.map(({ icon: Icon, n, title }) => (
        <span key={title} className="flex items-center gap-1" title={title}>
          <Icon className={size === 'xs' ? 'size-3' : 'size-3.5'} />
          {fmtCount(n)}
        </span>
      ))}
    </span>
  );
}
