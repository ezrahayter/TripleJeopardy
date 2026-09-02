import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, PostStatus } from '@shared/types';
import { isoToLocalInput, NETWORK_LABEL, timeAgo } from '@/lib/format';
import { Dateline } from '@/components/Dateline';
import { StatusChip } from '@/components/StatusChip';
import { PostThumbs } from '@/components/PostThumbs';
import { ApprovalLedger } from '@/components/ApprovalLedger';
import { PostMetricsBar, hasAnyMetrics, type Metrics } from '@/components/PostMetricsBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export interface DetailPost {
  id: string;
  body: string;
  status: PostStatus;
  approval_state: ApprovalState;
  scheduled_at: string | null;
  internal_note?: string | null;
  campaign: {
    id: string;
    name: string;
    approval_mode: ApprovalMode;
    approver_name: string | null;
    waived_networks?: string[];
    review_token?: string;
  } | null;
}

export function PostDetailSheet({
  post,
  onOpenChange,
  onReload,
  onChanged,
}: {
  post: DetailPost | null;
  onOpenChange: (open: boolean) => void;
  onReload: () => void | Promise<void>;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [targets, setTargets] = useState<
    {
      id: string;
      network: string;
      metrics: Metrics;
      synced: string | null;
      url: string | null;
      commentPosted: boolean;
      commentError: string | null;
    }[]
  >([]);

  const [extra, setExtra] = useState<{
    org_id: string;
    post_type: string;
    link_url: string | null;
    fundraise_goal: number | null;
    fundraise_raised: number | null;
    source_url: string | null;
  } | null>(null);
  const [boosts, setBoosts] = useState<
    { id: string; platform: string; amount: number; started_on: string | null; note: string | null }[]
  >([]);
  const [raisedInput, setRaisedInput] = useState('');
  const [boostForm, setBoostForm] = useState({ platform: 'Facebook', amount: '', started_on: '' });

  // reset the datetime field whenever a different post opens
  const key = post?.id ?? 'none';
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    setWhen(isoToLocalInput(post?.scheduled_at ?? null));
    setBoostForm({ platform: 'Facebook', amount: '', started_on: '' });
  }

  const loadExtra = useCallback(async () => {
    if (!post) return;
    const { data } = await supabase
      .from('posts')
      .select('org_id, post_type, link_url, fundraise_goal, fundraise_raised, source_url')
      .eq('id', post.id)
      .maybeSingle();
    setExtra(data as never);
    setRaisedInput(data?.fundraise_raised != null ? String(data.fundraise_raised) : '');
    const { data: b } = await supabase
      .from('post_boosts')
      .select('id, platform, amount, started_on, note')
      .eq('post_id', post.id)
      .order('created_at');
    setBoosts((b as never) ?? []);
  }, [post]);

  useEffect(() => {
    if (post) void loadExtra();
    else {
      setExtra(null);
      setBoosts([]);
    }
  }, [post, loadExtra]);

  async function run(
    op: PromiseLike<{ error: { message: string } | null }>,
    ok: string,
  ) {
    setBusy(true);
    const { error } = await op;
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(ok);
    onChanged();
  }

  const published = post?.status === 'published';
  const isDraft = post?.status === 'draft';

  async function saveRaised() {
    if (!post) return;
    const v = raisedInput.trim() === '' ? null : Number(raisedInput);
    await supabase.from('posts').update({ fundraise_raised: v }).eq('id', post.id);
    await loadExtra();
    toast.success('Amount raised updated');
  }

  async function addBoost() {
    if (!post || !extra || !boostForm.amount) return;
    const { error } = await supabase.from('post_boosts').insert({
      org_id: extra.org_id,
      post_id: post.id,
      platform: boostForm.platform.trim() || 'Facebook',
      amount: Number(boostForm.amount),
      started_on: boostForm.started_on || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBoostForm({ platform: 'Facebook', amount: '', started_on: '' });
    await loadExtra();
    toast.success('Boost logged');
  }

  async function deleteBoost(id: string) {
    await supabase.from('post_boosts').delete().eq('id', id);
    await loadExtra();
  }

  useEffect(() => {
    if (!post || post.status !== 'published') {
      setTargets([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('post_targets')
        .select(
          'id, external_url, metrics, metrics_synced_at, comment_external_id, comment_error, social_account:social_accounts(network)',
        )
        .eq('post_id', post.id)
        .eq('status', 'published');
      if (cancelled) return;
      setTargets(
        ((data as unknown as Array<Record<string, unknown>>) ?? []).map((t) => ({
          id: t.id as string,
          network: (t.social_account as { network?: string } | null)?.network ?? 'unknown',
          metrics: (t.metrics as Metrics) ?? {},
          synced: (t.metrics_synced_at as string) ?? null,
          url: (t.external_url as string) ?? null,
          commentPosted: !!t.comment_external_id,
          commentError: (t.comment_error as string) ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [post]);

  return (
    <Sheet open={!!post} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {post && (
          <>
            <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
              <Dateline
                campaign={post.campaign?.name}
                when={post.scheduled_at}
                className="mb-1"
              />
              <SheetTitle className="text-base">
                {post.body ? firstLine(post.body) : 'Untitled draft'}
              </SheetTitle>
              <div className="mt-1 flex gap-2">
                <StatusChip status={post.status} />
              </div>
            </SheetHeader>

            <section className="space-y-3 border-b border-border px-5 py-4">
              <h3 className="dateline">{published ? 'Post' : 'Draft'}</h3>
              <p className="whitespace-pre-wrap rounded-md border border-border bg-card p-3.5 text-sm leading-relaxed">
                {post.body || <span className="text-muted-foreground">No text</span>}
              </p>
              <PostThumbs postId={post.id} />
              {post.internal_note && (
                <p className="rounded-md border border-dashed border-border bg-secondary/40 p-2.5 text-xs">
                  <span className="dateline">Team note</span>
                  <span className="mt-0.5 block whitespace-pre-wrap">{post.internal_note}</span>
                </p>
              )}
              {extra && extra.post_type !== 'standard' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono uppercase tracking-wide">
                    {extra.post_type.replace('_', ' ')}
                  </span>
                  {extra.link_url && (
                    <a
                      href={extra.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--pf-brick)] underline"
                    >
                      CTA link
                    </a>
                  )}
                  {extra.source_url && (
                    <a
                      href={extra.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[color:var(--pf-brick)] underline"
                    >
                      source
                    </a>
                  )}
                </div>
              )}
            </section>

            {extra?.post_type === 'fundraising' && extra.fundraise_goal ? (
              <section className="space-y-2 border-b border-border px-5 py-4">
                <h3 className="dateline">Fundraising</h3>
                {(() => {
                  const raised = extra.fundraise_raised ?? 0;
                  const pct = Math.min(100, Math.round((raised / extra.fundraise_goal!) * 100));
                  return (
                    <>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-[color:var(--pf-olive)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="dateline">
                        ${raised.toLocaleString()} of ${extra.fundraise_goal!.toLocaleString()} · {pct}%
                      </div>
                    </>
                  );
                })()}
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={raisedInput}
                    onChange={(e) => setRaisedInput(e.target.value)}
                    placeholder="Amount raised"
                    className="h-8"
                  />
                  <Button size="sm" variant="secondary" onClick={() => void saveRaised()}>
                    Update
                  </Button>
                </div>
              </section>
            ) : null}

            {(boosts.length > 0 || published) && (
              <section className="space-y-2.5 border-b border-border px-5 py-4">
                <h3 className="dateline">Paid spend (FEC log)</h3>
                {boosts.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm"
                  >
                    <span className="font-medium tabular-nums">${b.amount.toLocaleString()}</span>
                    <span className="text-muted-foreground">{b.platform}</span>
                    {b.started_on && <span className="dateline">{b.started_on}</span>}
                    <button
                      type="button"
                      onClick={() => void deleteBoost(b.id)}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {published && (
                  <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
                    <Input
                      value={boostForm.platform}
                      onChange={(e) => setBoostForm((f) => ({ ...f, platform: e.target.value }))}
                      placeholder="Platform"
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={boostForm.amount}
                      onChange={(e) => setBoostForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="$"
                      className="h-8 w-20 text-xs"
                    />
                    <Button size="sm" disabled={!boostForm.amount} onClick={() => void addBoost()}>
                      Log
                    </Button>
                  </div>
                )}
              </section>
            )}

            {published && targets.length > 0 && (
              <section className="space-y-2.5 border-b border-border px-5 py-4">
                <h3 className="dateline">Performance</h3>
                {targets.map((t) => (
                  <div key={t.id} className="rounded-md border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {NETWORK_LABEL[t.network] ?? t.network}
                      </span>
                      {t.url && (
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="dateline text-[color:var(--pf-brick)]"
                        >
                          view
                        </a>
                      )}
                    </div>
                    {hasAnyMetrics(t.metrics) ? (
                      <PostMetricsBar metrics={t.metrics} network={t.network} className="mt-1.5" />
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.synced ? 'No engagement yet.' : 'Metrics not synced yet.'}
                      </p>
                    )}
                    {t.commentPosted && (
                      <p className="dateline mt-1.5 text-[color:var(--pf-olive)]">
                        first comment posted
                      </p>
                    )}
                    {t.commentError && (
                      <p className="mt-1.5 text-xs text-destructive">
                        first comment failed: {t.commentError}
                      </p>
                    )}
                    {t.synced && (
                      <p className="dateline mt-1.5">updated {timeAgo(t.synced)}</p>
                    )}
                  </div>
                ))}
              </section>
            )}

            {post.campaign && (
              <section className="border-b border-border px-5 py-4">
                <h3 className="dateline mb-3">Approval ledger</h3>
                <ApprovalLedger
                  post={{
                    id: post.id,
                    campaign_id: post.campaign.id,
                    approval_state: post.approval_state,
                  }}
                  draftBody={post.body}
                  campaign={{
                    approval_mode: post.campaign.approval_mode,
                    approver_name: post.campaign.approver_name,
                    waived_networks: post.campaign.waived_networks ?? [],
                    review_token: post.campaign.review_token,
                  }}
                  onChange={() => void onReload()}
                />
              </section>
            )}

            <section className="mt-auto space-y-3 px-5 py-4">
              {!published && (
                <>
                  <Label htmlFor="sheet-when">
                    {isDraft ? 'Put on the calendar for' : 'Scheduled for'}
                  </Label>
                  <Input
                    id="sheet-when"
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy || !when}
                      onClick={() =>
                        void run(
                          supabase
                            .from('posts')
                            .update({
                              status: 'scheduled',
                              scheduled_at: new Date(when).toISOString(),
                            })
                            .eq('id', post.id),
                          isDraft ? 'Added to the calendar' : 'Rescheduled',
                        )
                      }
                    >
                      {isDraft ? 'Add to calendar' : 'Reschedule'}
                    </Button>
                    {!isDraft && (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            supabase
                              .from('posts')
                              .update({ status: 'draft', scheduled_at: null })
                              .eq('id', post.id),
                            'Moved to drafts',
                          )
                        }
                      >
                        Move to drafts
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => navigate(`/compose/${post.id}`)}>
                      Edit draft
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          supabase.from('posts').delete().eq('id', post.id),
                          'Post deleted',
                        )
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </>
              )}
              {published && (
                <SheetClose asChild>
                  <Button variant="secondary">Close</Button>
                </SheetClose>
              )}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function firstLine(body: string) {
  const line = body.split('\n')[0]?.trim() ?? '';
  return line.length > 68 ? line.slice(0, 68) + '…' : line;
}
