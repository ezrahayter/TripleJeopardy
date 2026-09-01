import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, Post, PostTarget } from '@shared/types';
import { PageHeader } from '@/components/PageHeader';
import { Dateline } from '@/components/Dateline';
import { StatusChip, ApprovalChip } from '@/components/StatusChip';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Row = Post & {
  campaign: {
    id: string;
    name: string;
    approval_mode: ApprovalMode;
    approver_name: string | null;
  } | null;
  post_targets: Array<Pick<PostTarget, 'status' | 'external_url' | 'error'>>;
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
        '*, campaign:campaigns(id, name, approval_mode, approver_name), post_targets(status, external_url, error)',
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
                : 'border-input bg-card text-muted-foreground hover:border-input',
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

      {shown.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {shown.map((row) => {
            const published = row.status === 'published';
            return (
              <button
                type="button"
                key={row.id}
                onClick={() => setSelectedId(row.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 border-b border-border p-4 text-left last:border-b-0 hover:bg-background"
              >
                <Dateline
                  campaign={row.campaign?.name}
                  when={row.scheduled_at}
                  className="col-span-2"
                />
                <span className="truncate text-sm">
                  {row.body || <span className="text-muted-foreground">(no text)</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  {published || row.approval_state === 'not_required' ? (
                    <StatusChip status={row.status} />
                  ) : (
                    <ApprovalChip state={row.approval_state} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

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
