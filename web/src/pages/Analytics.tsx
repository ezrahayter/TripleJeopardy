import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { PageHeader } from '@/components/PageHeader';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import {
  PostMetricsBar,
  engagementOf,
  reachOf,
  fmtCount,
  type Metrics,
} from '@/components/PostMetricsBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Pub {
  id: string;
  published_at: string | null;
  external_url: string | null;
  network: string;
  campaign: string;
  body: string;
  metrics: Metrics;
  synced: string | null;
}

const WEEK_MS = 7 * 86400000;

export function Analytics({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('post_targets')
      .select(
        'id, published_at, external_url, metrics, metrics_synced_at, social_account:social_accounts(network), post:posts!inner(body, org_id, campaign:campaigns(name))',
      )
      .eq('status', 'published')
      .eq('post.org_id', orgId)
      .order('published_at', { ascending: false });

    const list: Pub[] = (
      (data as unknown as Array<{
        id: string;
        published_at: string | null;
        external_url: string | null;
        metrics: Metrics | null;
        metrics_synced_at: string | null;
        social_account: { network: string } | null;
        post: { body: string; campaign: { name: string } | null } | null;
      }>) ?? []
    ).map((r) => ({
      id: r.id,
      published_at: r.published_at,
      external_url: r.external_url,
      network: r.social_account?.network ?? 'unknown',
      campaign: r.post?.campaign?.name ?? '—',
      body: r.post?.body ?? '',
      metrics: r.metrics ?? {},
      synced: r.metrics_synced_at,
    }));
    setRows(list);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const thisMonth = rows.filter(
      (r) => r.published_at && new Date(r.published_at) >= monthStart,
    ).length;

    const weeks = Array.from({ length: 12 }, (_, i) => {
      const end = now - (11 - i) * WEEK_MS;
      const start = end - WEEK_MS;
      return rows.filter((r) => {
        if (!r.published_at) return false;
        const t = new Date(r.published_at).getTime();
        return t >= start && t < end;
      }).length;
    });
    const last8 = weeks.slice(4).reduce((a, b) => a + b, 0);

    const byNetwork = new Map<string, number>();
    for (const r of rows) byNetwork.set(r.network, (byNetwork.get(r.network) ?? 0) + 1);

    const totalEngagement = rows.reduce((s, r) => s + engagementOf(r.metrics), 0);
    const totalReach = rows.reduce((s, r) => s + reachOf(r.metrics), 0);
    const hasMetrics = rows.some((r) => r.synced);

    const top = [...rows]
      .filter((r) => engagementOf(r.metrics) > 0)
      .sort((a, b) => engagementOf(b.metrics) - engagementOf(a.metrics))
      .slice(0, 5);

    return {
      total: rows.length,
      thisMonth,
      perWeek: Math.round((last8 / 8) * 10) / 10,
      networks: byNetwork.size,
      weeks,
      byNetwork: [...byNetwork.entries()].sort((a, b) => b[1] - a[1]),
      totalEngagement,
      totalReach,
      hasMetrics,
      top,
    };
  }, [rows]);

  const maxWeek = Math.max(1, ...stats.weeks);
  const maxNet = Math.max(1, ...stats.byNetwork.map(([, n]) => n));

  const tiles: { label: string; value: string }[] = [
    { label: 'Published', value: fmtCount(stats.total) },
    { label: 'This month', value: fmtCount(stats.thisMonth) },
    { label: 'Posts / week', value: String(stats.perWeek) },
    stats.hasMetrics
      ? { label: 'Engagement', value: fmtCount(stats.totalEngagement) }
      : { label: 'Networks', value: String(stats.networks) },
    ...(stats.hasMetrics && stats.totalReach > 0
      ? [{ label: 'Reach', value: fmtCount(stats.totalReach) }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description={
          stats.hasMetrics
            ? 'Volume, consistency, and engagement — synced from each connected network a few times a day.'
            : 'Publishing volume and consistency. Engagement and reach fill in once a connected network has synced.'
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing published yet. Once posts go out, their history shows up here.
        </p>
      ) : (
        <div className="space-y-5">
          <div className={cn('grid gap-3', tiles.length >= 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
            {tiles.map((s) => (
              <Card key={s.label} className="gap-0 py-4">
                <CardContent className="px-4">
                  <div className="dateline">{s.label}</div>
                  <div className="mt-1 text-2xl font-black tabular-nums">{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.top.length > 0 && (
            <Card className="gap-0 overflow-hidden py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">Top posts</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {stats.top.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border p-4 last:border-b-0"
                  >
                    <CampaignAvatar name={r.campaign} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.body || '(no text)'}</span>
                      <PostMetricsBar metrics={r.metrics} network={r.network} className="mt-1" />
                    </span>
                    <span className="dateline shrink-0 tabular-nums">
                      {fmtCount(engagementOf(r.metrics))} eng.
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="gap-0 py-0">
            <CardHeader className="py-5">
              <CardTitle className="text-base">Last 12 weeks</CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="flex items-end gap-1.5" style={{ height: 100 }}>
                {stats.weeks.map((n, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="dateline tabular-nums">{n || ''}</span>
                    <div
                      className={cn('w-full rounded-sm', n ? 'bg-action' : 'bg-secondary')}
                      style={{ height: `${Math.max(4, (n / maxWeek) * 68)}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="dateline mt-2">12 weeks ago → now</div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="py-5">
              <CardTitle className="text-base">By network</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-5">
              {stats.byNetwork.map(([net, n]) => {
                const meta = NETWORKS[net as NetworkId];
                const Icon = meta?.icon;
                return (
                  <div key={net} className="flex items-center gap-3">
                    <span className="dateline flex w-24 items-center gap-1.5">
                      {Icon && <Icon className="size-3.5" />} {meta?.label ?? net}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-[color:var(--pf-olive)]"
                        style={{ width: `${(n / maxNet) * 100}%` }}
                      />
                    </div>
                    <span className="dateline w-8 text-right tabular-nums">{n}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Published posts</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {rows.slice(0, 40).map((r) => {
                const meta = NETWORKS[r.network as NetworkId];
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 border-b border-border p-4 last:border-b-0"
                  >
                    <CampaignAvatar name={r.campaign} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{r.body || '(no text)'}</span>
                      <span className="dateline flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          {meta?.label ?? r.network}
                          {r.published_at &&
                            ` · ${new Date(r.published_at).toLocaleDateString()}`}
                        </span>
                        {r.synced && (
                          <PostMetricsBar metrics={r.metrics} network={r.network} size="xs" />
                        )}
                      </span>
                    </span>
                    {r.external_url && (
                      <a
                        href={r.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="dateline flex items-center gap-1 text-[color:var(--pf-brick)]"
                      >
                        view <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
