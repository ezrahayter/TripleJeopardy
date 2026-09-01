import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { Button } from '@/components/ui/button';

interface Ev {
  event: string;
  actor: string | null;
  note: string | null;
  created_at: string;
}
interface ReportPost {
  id: string;
  body: string;
  approval_state: string;
  scheduled_at: string | null;
  campaign: { name: string } | null;
  approval_events: Ev[];
  post_targets: { social_account: { network: string } | null }[];
}

const EVENT_LABEL: Record<string, string> = {
  sent_for_review: 'Sent for review',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  reset: 'Approval reset (post edited)',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function ApprovalReport({
  orgId,
  campaignId,
  campaignName,
  onClose,
}: {
  orgId: string;
  campaignId?: string;
  campaignName?: string;
  onClose: () => void;
}) {
  const [posts, setPosts] = useState<ReportPost[]>([]);
  const [loading, setLoading] = useState(true);
  const generated = new Date();

  useEffect(() => {
    void (async () => {
      let q = supabase
        .from('posts')
        .select(
          'id, body, approval_state, scheduled_at, campaign:campaigns(name), approval_events(event, actor, note, created_at), post_targets(social_account:social_accounts(network))',
        )
        .eq('org_id', orgId)
        .neq('approval_state', 'not_required')
        .order('scheduled_at', { nullsFirst: false });
      if (campaignId) q = q.eq('campaign_id', campaignId);
      const { data } = await q;
      const rows = ((data as unknown as ReportPost[]) ?? []).map((p) => ({
        ...p,
        approval_events: [...(p.approval_events ?? [])].sort(
          (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
        ),
      }));
      setPosts(rows);
      setLoading(false);
    })();
  }, [orgId, campaignId]);

  return createPortal(
    <div className="tj-report-root fixed inset-0 z-[100] overflow-auto bg-[color:var(--pf-bone)] print:static print:overflow-visible">
      <style>{`@media print {
        body > *:not(.tj-report-root) { display: none !important; }
        .tj-report-chrome { display: none !important; }
        .tj-report { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
      }`}</style>

      <div className="tj-report-chrome sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <span className="dateline">Approval record</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="tj-report mx-auto my-8 max-w-3xl bg-white px-10 py-12 text-[#1a1a1a] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_20px_50px_-20px_rgba(0,0,0,0.2)] print:my-0">
        <div className="mb-8 border-b-2 border-[#1a1a1a] pb-4">
          <div className="font-display text-xl font-black tracking-tight">Triple Jeopardy</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#636b2f]">
            Positive Force
          </div>
          <h1 className="mt-4 font-display text-2xl font-black tracking-tight">
            Content approval record
          </h1>
          <p className="mt-1 text-sm text-[#555]">
            {campaignName ?? 'All campaigns'} · generated {fmt(generated.toISOString())}
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-[#777]">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-[#777]">
            No posts have entered the approval process for {campaignName ?? 'this workspace'}.
          </p>
        ) : (
          <>
            <p className="mb-6 text-sm leading-relaxed text-[#444]">
              This document lists every post submitted for approval, with a timestamped record of
              each decision. {posts.length} post{posts.length === 1 ? '' : 's'}.
            </p>
            <ol className="space-y-8">
              {posts.map((p, i) => {
                const nets = [
                  ...new Set(
                    p.post_targets
                      .map((t) => t.social_account?.network)
                      .filter((n): n is string => Boolean(n)),
                  ),
                ];
                const decided = p.approval_events.filter(
                  (e) => e.event === 'approved' || e.event === 'changes_requested',
                );
                const last = decided[decided.length - 1];
                return (
                  <li key={p.id} className="break-inside-avoid border-t border-[#ddd] pt-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-wide text-[#636b2f]">
                        Post {i + 1}
                        {p.campaign && ` · ${p.campaign.name}`}
                        {p.scheduled_at &&
                          ` · scheduled ${new Date(p.scheduled_at).toLocaleDateString()}`}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-wide">
                        {last
                          ? last.event === 'approved'
                            ? 'Approved'
                            : 'Changes requested'
                          : p.approval_state}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-[#ccc] pl-3 text-[13px] leading-relaxed">
                      {p.body || '(no text)'}
                    </p>

                    {nets.length > 0 && (
                      <p className="mt-2 text-[11px] text-[#777]">
                        Networks: {nets.map((n) => NETWORKS[n as NetworkId]?.label ?? n).join(', ')}
                      </p>
                    )}

                    <table className="mt-3 w-full text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[#ddd] text-[#777]">
                          <th className="py-1 pr-3 font-medium">When</th>
                          <th className="py-1 pr-3 font-medium">Who</th>
                          <th className="py-1 pr-3 font-medium">Event</th>
                          <th className="py-1 font-medium">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.approval_events.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-1.5 text-[#999]">
                              No recorded review activity — decision set directly.
                            </td>
                          </tr>
                        )}
                        {p.approval_events.map((e, j) => (
                          <tr key={j} className="border-b border-[#f0f0f0] align-top">
                            <td className="py-1.5 pr-3 tabular-nums">{fmt(e.created_at)}</td>
                            <td className="py-1.5 pr-3">
                              {e.actor === 'operator'
                                ? 'Operator'
                                : e.actor === 'reviewer'
                                  ? 'Reviewer'
                                  : e.actor === 'system'
                                    ? 'System'
                                    : (e.actor ?? '—')}
                            </td>
                            <td className="py-1.5 pr-3">{EVENT_LABEL[e.event] ?? e.event}</td>
                            <td className="py-1.5 italic text-[#555]">{e.note ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        <p className="mt-10 border-t border-[#ddd] pt-4 text-[11px] text-[#999]">
          Generated by Triple Jeopardy for Positive Force. Timestamps are recorded server-side at the
          moment each action occurred and are not editable.
        </p>
      </div>
    </div>,
    document.body,
  );
}
