import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, Campaign, PostStatus } from '@shared/types';
import { campaignTint } from '@/lib/campaignColor';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { PageHeader } from '@/components/PageHeader';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const SELECT =
  'id, body, status, approval_state, scheduled_at, internal_note, campaign:campaigns(id, name, approval_mode, approver_name, waived_networks, review_token), post_targets(social_account:social_accounts(network))';

interface CalPost {
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
  post_targets?: { social_account: { network: string } | null }[];
}

interface Anchor {
  id: string;
  label: string;
  date: string; // yyyy-mm-dd
  kind: string;
  campaign: string;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const STATUS_OPTS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
];

function edgeColor(p: CalPost) {
  if (p.status === 'published') return 'border-l-primary';
  if (p.status === 'failed') return 'border-l-destructive';
  if (p.approval_state === 'changes_requested') return 'border-l-destructive';
  if (p.approval_state === 'approved') return 'border-l-[color:var(--pf-olive)]';
  return 'border-l-action';
}

function networksOf(p: CalPost): string[] {
  return [
    ...new Set(
      (p.post_targets ?? [])
        .map((t) => t.social_account?.network)
        .filter((n): n is string => Boolean(n)),
    ),
  ];
}

function PostChip({ p, onOpen }: { p: CalPost; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `post:${p.id}` });
  const tint = campaignTint(p.campaign?.name ?? '—');
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{ background: tint.bg }}
      className={cn(
        'block w-full cursor-grab truncate border-l-2 px-1.5 py-0.5 text-left text-[11px] active:cursor-grabbing',
        edgeColor(p),
        isDragging && 'opacity-40',
      )}
    >
      {p.scheduled_at && (
        <span className="mr-1 font-mono text-[10px] opacity-60">
          {new Date(p.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
      {p.campaign?.name ?? 'No campaign'}: {p.body || '(no text)'}
    </div>
  );
}

function DayCell({
  date,
  posts,
  anchors,
  dim,
  today,
  tall,
  onNew,
  onOpen,
}: {
  date: Date;
  posts: CalPost[];
  anchors: Anchor[];
  dim?: boolean;
  today?: boolean;
  tall?: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date.toISOString()}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onNew}
      className={cn(
        'flex cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 transition-colors',
        tall ? 'min-h-[220px]' : 'min-h-[104px]',
        dim && 'bg-card/60',
        isOver && 'bg-action/10 ring-1 ring-inset ring-action',
      )}
    >
      <span
        className={cn(
          'dateline self-start !text-[11px]',
          dim && 'opacity-40',
          today && 'rounded bg-[color:var(--pf-brick)] px-1 text-[color:var(--pf-bone)]',
        )}
      >
        {date.getDate()}
      </span>

      {anchors.map((a) => (
        <div
          key={a.id}
          title={`${a.campaign} · ${a.label}`}
          className="flex items-center gap-1 truncate rounded-sm bg-[color:var(--pf-brick)]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--pf-brick)]"
        >
          <Flag className="size-2.5 shrink-0" />
          <span className="truncate">{a.label}</span>
        </div>
      ))}

      {posts.map((p) => (
        <PostChip key={p.id} p={p} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  );
}

export function Calendar({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const [view, setView] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [drafts, setDrafts] = useState<CalPost[]>([]);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campaignFilter, setCampaignFilter] = useState('all');
  const [networkFilter, setNetworkFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cells = useMemo(() => {
    if (view === 'week') {
      const s = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(s);
        d.setDate(s.getDate() + i);
        return d;
      });
    }
    const s = startOfMonth(cursor);
    s.setDate(s.getDate() - s.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [cursor, view]);

  const selected = useMemo<DetailPost | null>(
    () => [...posts, ...drafts].find((p) => p.id === selectedId) ?? null,
    [posts, drafts, selectedId],
  );

  const load = useCallback(async () => {
    const gridStart = new Date(cells[0]!);
    const gridEnd = new Date(cells[cells.length - 1]!);
    gridEnd.setDate(gridEnd.getDate() + 1);

    const { data, error } = await supabase
      .from('posts')
      .select(SELECT)
      .eq('org_id', orgId)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', gridStart.toISOString())
      .lt('scheduled_at', gridEnd.toISOString())
      .order('scheduled_at');
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setPosts((data as unknown as CalPost[]) ?? []);

    const { data: draftRows } = await supabase
      .from('posts')
      .select(SELECT)
      .eq('org_id', orgId)
      .is('scheduled_at', null)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });
    setDrafts((draftRows as unknown as CalPost[]) ?? []);

    const { data: dateRows } = await supabase
      .from('campaign_dates')
      .select('id, label, date, kind, campaign:campaigns(name)')
      .eq('org_id', orgId)
      .gte('date', ymd(gridStart))
      .lte('date', ymd(gridEnd));
    const explicit: Anchor[] = ((dateRows as unknown as Array<Record<string, any>>) ?? []).map(
      (r) => ({
        id: r.id,
        label: r.label,
        date: r.date,
        kind: r.kind,
        campaign: r.campaign?.name ?? '—',
      }),
    );
    // campaigns.election_date is a built-in anchor
    const elections: Anchor[] = campaigns
      .filter((c) => c.election_date)
      .map((c) => ({
        id: `election-${c.id}`,
        label: 'Election day',
        date: c.election_date!.slice(0, 10),
        kind: 'election',
        campaign: c.name,
      }));
    setAnchors([...explicit, ...elections]);
  }, [orgId, cells, campaigns]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (campaignFilter !== 'all' && p.campaign?.id !== campaignFilter) return false;
      if (statusFilter.length && !statusFilter.includes(p.status)) return false;
      if (networkFilter.length) {
        const nets = networksOf(p);
        if (!nets.some((n) => networkFilter.includes(n))) return false;
      }
      return true;
    });
  }, [posts, campaignFilter, statusFilter, networkFilter]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of filtered) {
      if (!p.scheduled_at) continue;
      const k = dayKey(new Date(p.scheduled_at));
      const arr = m.get(k);
      if (arr) arr.push(p);
      else m.set(k, [p]);
    }
    return m;
  }, [filtered]);

  const anchorsByDay = useMemo(() => {
    const m = new Map<string, Anchor[]>();
    for (const a of anchors) {
      if (campaignFilter !== 'all') {
        const c = campaigns.find((x) => x.id === campaignFilter);
        if (c && a.campaign !== c.name) continue;
      }
      const k = dayKey(new Date(`${a.date}T12:00:00`));
      const arr = m.get(k);
      if (arr) arr.push(a);
      else m.set(k, [a]);
    }
    return m;
  }, [anchors, campaignFilter, campaigns]);

  const draftsShown = useMemo(
    () =>
      drafts.filter(
        (d) => campaignFilter === 'all' || d.campaign?.id === campaignFilter,
      ),
    [drafts, campaignFilter],
  );

  function newPostOn(d: Date) {
    const at = new Date(d);
    at.setHours(9, 0, 0, 0);
    navigate(`/compose?at=${encodeURIComponent(at.toISOString())}`);
  }

  async function onDragEnd(e: DragEndEvent) {
    const postId = String(e.active.id).replace('post:', '');
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId?.startsWith('day:')) return;
    const target = new Date(overId.replace('day:', ''));
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.scheduled_at) return;
    const orig = new Date(post.scheduled_at);
    if (sameDay(orig, target)) return;
    const next = new Date(target);
    next.setHours(orig.getHours(), orig.getMinutes(), 0, 0);

    setPosts((ps) =>
      ps.map((p) => (p.id === postId ? { ...p, scheduled_at: next.toISOString() } : p)),
    );
    const { error } = await supabase
      .from('posts')
      .update({ scheduled_at: next.toISOString() })
      .eq('id', postId);
    if (error) {
      toast.error(error.message);
      void load();
    } else {
      toast.success(
        `Moved to ${next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      );
    }
  }

  const shift = (n: number) => {
    const d = new Date(cursor);
    if (view === 'week') d.setDate(d.getDate() + n * 7);
    else d.setMonth(d.getMonth() + n);
    setCursor(d);
  };

  const title =
    view === 'week'
      ? (() => {
          const s = startOfWeek(cursor);
          const e = new Date(s);
          e.setDate(s.getDate() + 6);
          return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${
            s.getMonth() === e.getMonth() ? e.getDate() : `${MONTHS[e.getMonth()]} ${e.getDate()}`
          }`;
        })()
      : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeNetworks = useMemo(() => {
    const s = new Set<string>();
    for (const p of posts) networksOf(p).forEach((n) => s.add(n));
    return [...s];
  }, [posts]);

  return (
    <>
      <PageHeader
        title={title}
        description="Drag a post to another day to reschedule it. Click a day to plan one."
        action={
          <>
            <div className="flex overflow-hidden rounded-md border border-input">
              {(['month', 'week'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium capitalize',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" aria-label="Previous" onClick={() => shift(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next" onClick={() => shift(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {campaigns.length > 1 && (
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {activeNetworks.length > 1 &&
          activeNetworks.map((n) => {
            const meta = NETWORKS[n as NetworkId];
            const on = networkFilter.includes(n);
            const Icon = meta?.icon;
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(networkFilter, setNetworkFilter, n)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground',
                )}
              >
                {Icon && <Icon className="size-3" />} {meta?.label ?? n}
              </button>
            );
          })}

        {STATUS_OPTS.map((s) => {
          const on = statusFilter.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggle(statusFilter, setStatusFilter, s.value)}
              className={cn(
                'rounded-full border px-2 py-1 text-xs transition-colors',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input text-muted-foreground',
              )}
            >
              {s.label}
            </button>
          );
        })}

        {(campaignFilter !== 'all' || networkFilter.length || statusFilter.length) && (
          <button
            type="button"
            onClick={() => {
              setCampaignFilter('all');
              setNetworkFilter([]);
              setStatusFilter([]);
            }}
            className="dateline text-[color:var(--pf-brick)]"
          >
            Clear
          </button>
        )}
      </div>

      {draftsShown.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="dateline mb-2">
            {draftsShown.length} unscheduled draft{draftsShown.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-col gap-1">
            {draftsShown.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className="truncate rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-sm hover:border-input"
              >
                <span className="font-medium">{d.campaign?.name ?? '—'}</span>{' '}
                <span className="text-muted-foreground">
                  {d.body ? d.body.slice(0, 80) : '(no text)'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <div
            className={cn(
              'grid min-w-[640px] grid-cols-7 overflow-hidden rounded-lg border border-border',
              '[&>*]:border-r [&>*:nth-child(7n)]:border-r-0',
            )}
          >
            {DOW.map((d) => (
              <div key={d} className="dateline border-b border-border bg-card px-2 py-1.5">
                {d}
              </div>
            ))}
            {cells.map((d, i) => (
              <DayCell
                key={i}
                date={d}
                posts={byDay.get(dayKey(d)) ?? []}
                anchors={anchorsByDay.get(dayKey(d)) ?? []}
                dim={view === 'month' && d.getMonth() !== cursor.getMonth()}
                today={sameDay(d, new Date())}
                tall={view === 'week'}
                onNew={() => newPostOn(d)}
                onOpen={setSelectedId}
              />
            ))}
          </div>
        </div>
      </DndContext>

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
