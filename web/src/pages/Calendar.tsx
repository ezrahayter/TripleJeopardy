import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalState, ApprovalMode, PostStatus } from '@shared/types';
import { PageHeader } from '@/components/PageHeader';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SELECT =
  'id, body, status, approval_state, scheduled_at, campaign:campaigns(id, name, approval_mode, approver_name)';

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
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function Calendar({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [drafts, setDrafts] = useState<CalPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo<DetailPost | null>(
    () => [...posts, ...drafts].find((p) => p.id === selectedId) ?? null,
    [posts, drafts, selectedId],
  );

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const load = useCallback(async () => {
    const gridStart = new Date(cells[0]!);
    const gridEnd = new Date(cells[41]!);
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
  }, [orgId, cells]);

  useEffect(() => {
    void load();
  }, [load]);

  const postsFor = (d: Date) =>
    posts.filter((p) => p.scheduled_at && sameDay(new Date(p.scheduled_at), d));

  function newPostOn(d: Date) {
    const at = new Date(d);
    at.setHours(9, 0, 0, 0);
    navigate(`/compose?at=${encodeURIComponent(at.toISOString())}`);
  }

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <>
      <PageHeader
        title={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}
        description="Every scheduled and draft post for this workspace. Click a day to plan one."
        action={
          <>
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </>
        }
      />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {drafts.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="dateline mb-2">
            {drafts.length} unscheduled draft{drafts.length > 1 ? 's' : ''}
          </div>
          <div className="flex flex-col gap-1">
            {drafts.map((d) => (
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

      <div className="overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-7 overflow-hidden rounded-lg border border-border">
          {DOW.map((d) => (
            <div
              key={d}
              className="dateline border-b border-border bg-card px-2 py-1.5"
            >
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth();
            const today = sameDay(d, new Date());
            return (
              <div
                key={i}
                onClick={() => newPostOn(d)}
                className={cn(
                  'flex min-h-[104px] cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/60',
                  !inMonth && 'bg-card/60',
                  i % 7 === 6 && 'border-r-0',
                )}
              >
                <span
                  className={cn(
                    'dateline self-start !text-[11px]',
                    !inMonth && 'opacity-40',
                    today &&
                      'rounded bg-[color:var(--pf-brick)] px-1 text-[color:var(--pf-bone)]',
                  )}
                >
                  {d.getDate()}
                </span>
                {postsFor(d).map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(p.id);
                    }}
                    className={cn(
                      'w-full text-left',
                      'block truncate border-l-2 bg-background px-1.5 py-0.5 text-[11px]',
                      p.status === 'published'
                        ? 'border-l-primary'
                        : p.status === 'failed'
                          ? 'border-l-destructive'
                          : 'border-l-action',
                    )}
                  >
                    {p.campaign?.name ?? 'No campaign'}: {p.body || '(no text)'}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
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
