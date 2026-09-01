import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, Plug } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, PostStatus } from '@shared/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { timeAgo } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import { Dateline } from '@/components/Dateline';
import { ApprovalChip } from '@/components/StatusChip';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SELECT =
  'id, body, status, approval_state, scheduled_at, campaign:campaigns(id, name, approval_mode, approver_name)';

interface Row {
  id: string;
  body: string;
  status: PostStatus;
  approval_state: ApprovalState;
  scheduled_at: string | null;
  campaign: {
    id: string;
    name: string;
    approval_mode: ApprovalMode;
    approver_name: string | null;
  } | null;
}

interface Conn {
  id: string;
  name: string;
  networks: { network: string; status: string }[];
}

export function Dashboard({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [queue, setQueue] = useState<Row[]>([]);
  const [week, setWeek] = useState<number[]>(Array(7).fill(0));
  const [conns, setConns] = useState<Conn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);

    const [{ data: appr }, { data: q }, { data: wk }, { data: campaigns }] = await Promise.all([
      supabase
        .from('posts')
        .select(SELECT)
        .eq('org_id', orgId)
        .in('approval_state', ['pending', 'changes_requested'])
        .order('scheduled_at', { nullsFirst: false }),
      supabase
        .from('posts')
        .select(SELECT)
        .eq('org_id', orgId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at')
        .limit(6),
      supabase
        .from('posts')
        .select('scheduled_at')
        .eq('org_id', orgId)
        .gte('scheduled_at', now.toISOString())
        .lt('scheduled_at', weekEnd.toISOString())
        .not('scheduled_at', 'is', null),
      supabase
        .from('campaigns')
        .select('id, name, social_accounts(network, status)')
        .eq('org_id', orgId)
        .order('created_at'),
    ]);

    setApprovals((appr as unknown as Row[]) ?? []);
    setQueue((q as unknown as Row[]) ?? []);

    const counts = Array(7).fill(0);
    for (const r of (wk as { scheduled_at: string }[]) ?? []) {
      const dayIdx = Math.floor(
        (new Date(r.scheduled_at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
      );
      if (dayIdx >= 0 && dayIdx < 7) counts[dayIdx]++;
    }
    setWeek(counts);

    setConns(
      ((campaigns as unknown as Array<{ id: string; name: string; social_accounts: { network: string; status: string }[] }>) ?? []).map(
        (c) => ({ id: c.id, name: c.name, networks: c.social_accounts ?? [] }),
      ),
    );
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo<DetailPost | null>(
    () => [...approvals, ...queue].find((r) => r.id === selectedId) ?? null,
    [approvals, queue, selectedId],
  );

  const changes = approvals.filter((a) => a.approval_state === 'changes_requested');
  const waiting = approvals.filter((a) => a.approval_state === 'pending');
  const maxWeek = Math.max(1, ...week);

  return (
    <>
      <PageHeader
        title="Overview"
        description="What needs you, what's going out, and what's connected."
        action={
          <Button asChild>
            <Link to="/compose">
              <CalendarPlus className="size-4" /> New post
            </Link>
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* attention */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Needs your attention</h2>
              {approvals.length > 0 && (
                <Link to="/approvals" className="dateline flex items-center gap-1 hover:text-foreground">
                  All <ArrowRight className="size-3" />
                </Link>
              )}
            </div>
            {approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in review. You're clear.</p>
            ) : (
              <ul className="space-y-1.5">
                {changes.concat(waiting).slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left hover:border-input"
                    >
                      <CampaignAvatar name={r.campaign?.name ?? '—'} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {r.body || <span className="text-muted-foreground">(no text)</span>}
                        </span>
                        <span className="dateline">{r.campaign?.name}</span>
                      </span>
                      <ApprovalChip state={r.approval_state} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* queue */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Next up</h2>
              <Link to="/calendar" className="dateline flex items-center gap-1 hover:text-foreground">
                Calendar <ArrowRight className="size-3" />
              </Link>
            </div>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled. Plan something.</p>
            ) : (
              <ul className="space-y-1.5">
                {queue.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-2.5 text-left hover:border-input"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          {r.body || <span className="text-muted-foreground">(no text)</span>}
                        </span>
                        <Dateline campaign={r.campaign?.name} when={r.scheduled_at} />
                      </span>
                      <span className="dateline shrink-0">{timeAgo(r.scheduled_at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* this week */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-bold">This week</h2>
            <div className="flex items-end justify-between gap-2" style={{ height: 96 }}>
              {week.map((n, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="dateline tabular-nums">{n || ''}</span>
                    <div
                      className={cn(
                        'w-full rounded-sm',
                        n ? 'bg-action' : 'bg-secondary',
                      )}
                      style={{ height: `${Math.max(4, (n / maxWeek) * 64)}px` }}
                    />
                    <span className="dateline">
                      {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* connections */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">Connections</h2>
              <Link to="/accounts" className="dateline flex items-center gap-1 hover:text-foreground">
                Manage <ArrowRight className="size-3" />
              </Link>
            </div>
            <ul className="space-y-2">
              {conns.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <CampaignAvatar name={c.name} size={28} />
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  {c.networks.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate('/accounts')}
                      className="dateline flex items-center gap-1 text-[color:var(--pf-brick)]"
                    >
                      <Plug className="size-3" /> connect
                    </button>
                  ) : (
                    <span className="flex gap-1">
                      {c.networks.map((n, i) => {
                        const meta = NETWORKS[n.network as NetworkId];
                        if (!meta) return null;
                        const Icon = meta.icon;
                        return (
                          <span
                            key={i}
                            title={`${meta.label} · ${n.status}`}
                            className={cn(
                              'grid size-6 place-items-center rounded-full border',
                              n.status === 'active'
                                ? 'border-border text-foreground'
                                : 'border-destructive text-destructive',
                            )}
                          >
                            <Icon className="size-3" />
                          </span>
                        );
                      })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
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
