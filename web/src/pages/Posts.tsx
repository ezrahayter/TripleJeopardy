import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, Post } from '@shared/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { timeAgo } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import { Dateline } from '@/components/Dateline';
import { StatusChip, ApprovalChip } from '@/components/StatusChip';
import { PostThumbs } from '@/components/PostThumbs';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Target = {
  status: string;
  external_url: string | null;
  error: string | null;
  social_account: { network: string; handle: string } | null;
};

type Row = Post & {
  campaign: {
    id: string;
    name: string;
    approval_mode: ApprovalMode;
    approver_name: string | null;
  } | null;
  post_targets: Target[];
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'In review' },
  { key: 'changes_requested', label: 'Changes' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export function Posts({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select(
        '*, campaign:campaigns(id, name, approval_mode, approver_name, waived_networks), post_targets(status, external_url, error, social_account:social_accounts(network, handle))',
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) setError(error.message);
    else setRows((data as unknown as Row[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'published') return rows.filter((r) => r.status === 'published');
    return rows.filter((r) => r.approval_state === (filter as ApprovalState));
  }, [rows, filter]);

  const selected = useMemo<DetailPost | null>(() => {
    const r = rows.find((x) => x.id === selectedId);
    if (!r) return null;
    return {
      id: r.id,
      body: r.body,
      status: r.status,
      approval_state: r.approval_state,
      scheduled_at: r.scheduled_at,
      campaign: r.campaign,
    };
  }, [rows, selectedId]);

  return (
    <>
      <PageHeader
        title="Posts"
        description="Everything drafted, scheduled, and published for this workspace."
        action={
          <>
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void load()}>
              <RefreshCw className="size-4" />
            </Button>
            <Button asChild>
              <Link to="/compose">
                <Plus className="size-4" /> New post
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] transition-colors',
              filter === f.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && shown.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {filter === 'all' ? 'No posts yet. Compose your first one.' : 'Nothing here.'}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((row) => {
          const published = row.status === 'published';
          const nets = [
            ...new Set(
              row.post_targets
                .map((t) => t.social_account?.network)
                .filter((n): n is string => Boolean(n)),
            ),
          ];
          const links = row.post_targets.filter((t) => t.external_url);
          const errs = row.post_targets.filter((t) => t.error);
          return (
            <button
              type="button"
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-input"
            >
              <div className="flex items-center gap-2.5">
                <CampaignAvatar name={row.campaign?.name ?? '—'} size={32} />
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-semibold">
                    {row.campaign?.name ?? 'Unknown campaign'}
                  </div>
                  <div className="dateline">
                    {published && row.scheduled_at
                      ? `published ${timeAgo(row.scheduled_at)}`
                      : row.scheduled_at
                        ? timeAgo(row.scheduled_at)
                        : `drafted ${timeAgo(row.created_at)}`}
                  </div>
                </div>
                {published || row.approval_state === 'not_required' ? (
                  <StatusChip status={row.status} />
                ) : (
                  <ApprovalChip state={row.approval_state} />
                )}
              </div>

              <p className="line-clamp-3 whitespace-pre-wrap text-sm">
                {row.body || <span className="text-muted-foreground">(no text)</span>}
              </p>

              <PostThumbs postId={row.id} size={52} />

              <div className="mt-auto flex items-center gap-2 pt-1">
                {nets.length > 0 ? (
                  <span className="flex gap-1">
                    {nets.map((n) => {
                      const meta = NETWORKS[n as NetworkId];
                      if (!meta) return null;
                      const Icon = meta.icon;
                      return (
                        <span
                          key={n}
                          className="grid size-5 place-items-center rounded-full border border-border text-muted-foreground"
                        >
                          <Icon className="size-3" />
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <Dateline campaign={undefined} when={row.scheduled_at} fallback="Draft" />
                )}
                {links.length > 0 && (
                  <span className="dateline flex items-center gap-1 text-[color:var(--pf-brick)]">
                    <ExternalLink className="size-3" /> {links.length} live
                  </span>
                )}
                {errs.length > 0 && (
                  <span className="dateline text-destructive">{errs.length} failed</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <PostDetailSheet
        post={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onReload={load}
        onChanged={() => {
          setSelectedId(null);
          void load();
        }}
      />
    </>
  );
}
