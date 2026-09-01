import { useCallback, useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalEvent, ApprovalMode, ApprovalState } from '@shared/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { ApprovalChip } from '@/components/StatusChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EVENT_LABEL: Record<ApprovalEvent['event'], string> = {
  sent_for_review: 'Sent for review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  reset: 'Approval reset — post edited',
};

function actorName(actor: string | null, approverName: string | null) {
  if (!actor || actor === 'operator') return 'you';
  if (actor === 'system') return 'system';
  if (actor === 'reviewer') return approverName ?? 'reviewer';
  return actor;
}

export function ApprovalLedger({
  post,
  campaign,
  onChange,
}: {
  post: { id: string; campaign_id: string; approval_state: ApprovalState };
  campaign: {
    approval_mode: ApprovalMode;
    approver_name: string | null;
    waived_networks?: string[];
  };
  onChange: () => void;
}) {
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: ev } = await supabase
      .from('approval_events')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setEvents((ev as unknown as ApprovalEvent[]) ?? []);
    const { data: link } = await supabase
      .from('review_links')
      .select('token')
      .eq('post_id', post.id)
      .is('decided_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setToken((link?.token as string) ?? null);
  }, [post.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (campaign.approval_mode === 'waived') {
    return (
      <p className="text-sm text-muted-foreground">
        Approval is waived for this campaign. Posts publish without sign-off.
      </p>
    );
  }

  const waived = campaign.waived_networks ?? [];
  const reviewUrl = token ? `${window.location.origin}/review/${token}` : null;
  const canSend =
    post.approval_state === 'not_required' || post.approval_state === 'changes_requested';

  async function sendForReview() {
    setBusy(true);
    setErr(null);
    const { data: link, error } = await supabase
      .from('review_links')
      .insert({ post_id: post.id, campaign_id: post.campaign_id })
      .select('token')
      .single();
    if (error || !link) {
      setErr(error?.message ?? 'Could not create a review link.');
      setBusy(false);
      return;
    }
    await supabase.from('posts').update({ approval_state: 'pending' }).eq('id', post.id);
    await supabase
      .from('approval_events')
      .insert({ post_id: post.id, event: 'sent_for_review', actor: 'operator' });
    setBusy(false);
    await load();
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ApprovalChip state={post.approval_state} />
        {campaign.approver_name && (
          <span className="text-xs text-muted-foreground">{campaign.approver_name}</span>
        )}
      </div>

      {waived.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {waived.map((n) => NETWORKS[n as NetworkId]?.label ?? n).join(' and ')} publish without
          sign-off — approval here covers the other networks.
        </p>
      )}

      {err && <p className="text-sm text-destructive">{err}</p>}

      {events.length > 0 && (
        <ol className="relative ml-1 space-y-4 border-l border-input pl-5">
          {events.map((e) => {
            const isDecision = e.event === 'approved' || e.event === 'changes_requested';
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[26px] top-1 size-[9px] rounded-full border-[1.5px] ${
                    isDecision
                      ? 'border-action bg-action'
                      : 'border-[color:var(--pf-olive)] bg-background'
                  }`}
                />
                <div className="dateline">
                  {new Date(e.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {actorName(e.actor, campaign.approver_name)}
                </div>
                <div className="mt-0.5 text-sm">
                  <span className={isDecision ? 'font-semibold' : ''}>{EVENT_LABEL[e.event]}</span>
                </div>
                {e.note && (
                  <p className="mt-1.5 border-l-2 border-destructive pl-2.5 text-[13px] italic text-[color:var(--pf-ink-soft)]">
                    &ldquo;{e.note}&rdquo;
                  </p>
                )}
              </li>
            );
          })}
          {canSend && (
            <li className="relative">
              <span className="absolute -left-[26px] top-1 size-[9px] rounded-full border-[1.5px] border-input bg-background" />
              <div className="dateline">Next · you</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {post.approval_state === 'changes_requested'
                  ? 'Revise and re-send'
                  : 'Send to the approver'}
              </div>
            </li>
          )}
        </ol>
      )}

      {canSend && (
        <Button variant="action" size="sm" disabled={busy} onClick={() => void sendForReview()}>
          <Check className="size-4" />
          {post.approval_state === 'changes_requested' ? 'Re-send for review' : 'Send for review'}
        </Button>
      )}

      {post.approval_state === 'pending' && reviewUrl && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            Send this link to {campaign.approver_name ?? 'the approver'} — no login needed.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={reviewUrl} onFocus={(e) => e.target.select()} className="text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(reviewUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
