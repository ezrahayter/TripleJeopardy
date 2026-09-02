import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, Campaign } from '@shared/types';
import { ALL_NETWORKS, type NetworkId } from '@/lib/networks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const MODE_LABEL: Record<ApprovalMode, string> = {
  candidate: 'Candidate approves every post',
  designated: 'A designated person approves',
  waived: 'Approval waived — posts publish without sign-off',
};

export function CampaignApproval({
  campaign,
  onSave,
}: {
  campaign: Campaign;
  onSave: (v: {
    approval_mode: ApprovalMode;
    approver_name: string | null;
    approver_email: string | null;
    waived_networks: string[];
    disclaimer: string | null;
    requests_enabled: boolean;
    review_nudge_hours: number;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ApprovalMode>(campaign.approval_mode);
  const [name, setName] = useState(campaign.approver_name ?? '');
  const [email, setEmail] = useState(campaign.approver_email ?? '');
  const [waived, setWaived] = useState<string[]>(campaign.waived_networks ?? []);
  const [disclaimer, setDisclaimer] = useState(campaign.disclaimer ?? '');
  const [requestsEnabled, setRequestsEnabled] = useState(campaign.requests_enabled !== false);
  const [nudgeHours, setNudgeHours] = useState(String(campaign.review_nudge_hours ?? 0));
  const [reviewToken, setReviewToken] = useState(campaign.review_token);
  const [copied, setCopied] = useState(false);
  const [icalCopied, setIcalCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportToken, setReportToken] = useState(campaign.report_token);
  const [recapAt, setRecapAt] = useState(campaign.report_recap_at);
  const [reportBusy, setReportBusy] = useState<string | null>(null);

  const portalUrl = `${window.location.origin}/review/${reviewToken}`;
  const icalUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed?token=${reviewToken}`;
  const reportUrl = reportToken ? `${window.location.origin}/report/${reportToken}` : null;

  async function report(action: 'setup' | 'revoke' | 'recap') {
    setReportBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke('report', {
        body: { action, campaign_id: campaign.id },
      });
      if (error) throw new Error(error.message);
      const out = (data as { token?: string; recapAt?: string; error?: string }) ?? {};
      if (out.error) throw new Error(out.error);
      if (action === 'setup') setReportToken(out.token ?? null);
      if (action === 'revoke') {
        setReportToken(null);
        setRecapAt(null);
      }
      if (action === 'recap') {
        setRecapAt(out.recapAt ?? null);
        toast.success('Summary updated');
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setReportBusy(null);
    }
  }

  async function rotate() {
    if (!window.confirm('Make a new link? The old one stops working immediately.')) return;
    const { data, error } = await supabase.rpc('tj_rotate_review_token', {
      p_campaign: campaign.id,
    });
    if (error) toast.error(error.message);
    else {
      setReviewToken(data as string);
      toast.success('New review link generated');
    }
  }

  const summary =
    campaign.approval_mode === 'waived'
      ? 'Approval waived'
      : `${campaign.approval_mode === 'candidate' ? 'Candidate approves' : 'Designated approver'}${
          campaign.approver_name ? ` · ${campaign.approver_name}` : ''
        }${campaign.waived_networks?.length ? ` · ${campaign.waived_networks.length} waived` : ''}`;

  function toggleWaived(id: NetworkId) {
    setWaived((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));
  }

  async function save() {
    setBusy(true);
    try {
      await onSave({
        approval_mode: mode,
        approver_name: mode === 'waived' ? null : name,
        approver_email: mode === 'waived' ? null : email,
        waived_networks: mode === 'waived' ? [] : waived,
        disclaimer,
        requests_enabled: requestsEnabled,
        review_nudge_hours: Math.max(0, parseInt(nudgeHours || '0', 10) || 0),
      });
      toast.success('Campaign settings saved');
      setOpen(false);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="dateline flex items-center gap-1"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Approval: {summary}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`mode-${campaign.id}`}>How posts get approved</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ApprovalMode)}>
              <SelectTrigger id={`mode-${campaign.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABEL) as ApprovalMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABEL[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode !== 'waived' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`an-${campaign.id}`}>
                  {mode === 'candidate' ? "Candidate's name" : "Approver's name"}
                </Label>
                <Input
                  id={`an-${campaign.id}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maria Rivera"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`ae-${campaign.id}`}>Their email</Label>
                <p className="text-xs text-muted-foreground">
                  Gets the portal link when a post is sent for review.
                </p>
                <Input
                  id={`ae-${campaign.id}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`nudge-${campaign.id}`}>Nudge if not approved within</Label>
                <p className="text-xs text-muted-foreground">
                  Re-emails the reminder after this many hours. 0 turns it off.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    id={`nudge-${campaign.id}`}
                    type="number"
                    min={0}
                    className="w-24"
                    value={nudgeHours}
                    onChange={(e) => setNudgeHours(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Waive approval for specific networks</Label>
                <p className="text-xs text-muted-foreground">
                  Posts to these publish without sign-off, even in {mode} mode — matches a
                  contract that waives Facebook and Instagram only.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ALL_NETWORKS.map((n) => {
                    const on = waived.includes(n.id);
                    const Icon = n.icon;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => toggleWaived(n.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                          on
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-card text-muted-foreground',
                        )}
                      >
                        <Icon className="size-3.5" /> {n.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={`disc-${campaign.id}`}>Disclaimer</Label>
            <p className="text-xs text-muted-foreground">
              Offered in the composer to append to posts, e.g. “Paid for by Rivera for HD 69.”
            </p>
            <Textarea
              id={`disc-${campaign.id}`}
              rows={2}
              value={disclaimer}
              onChange={(e) => setDisclaimer(e.target.value)}
              placeholder="Paid for by Rivera for HD 69."
            />
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <Label>Candidate portal</Label>
            <p className="text-xs text-muted-foreground">
              One stable page for {name || 'the candidate'} — no login. They approve every pending
              post there, and{' '}
              {requestsEnabled ? 'can also submit new post requests' : 'requests are turned off'}.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={requestsEnabled}
              onClick={() => setRequestsEnabled((v) => !v)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors',
                requestsEnabled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-3.5 place-items-center rounded-full border',
                  requestsEnabled ? 'border-primary-foreground' : 'border-muted-foreground',
                )}
              >
                {requestsEnabled && <Check className="size-2.5" />}
              </span>
              Let the candidate request posts
            </button>
            <div className="flex gap-2 pt-1">
              <Input readOnly value={portalUrl} onFocus={(e) => e.target.select()} className="text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(portalUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => void rotate()}
              className="dateline text-[color:var(--pf-brick)]"
            >
              Reset link
            </button>
            <div className="border-t border-border pt-3">
              <p className="dateline mb-1.5">Calendar subscription</p>
              <div className="flex gap-2">
                <Input readOnly value={icalUrl} onFocus={(e) => e.target.select()} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(icalUrl);
                    setIcalCopied(true);
                    setTimeout(() => setIcalCopied(false), 1500);
                  }}
                >
                  {icalCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {icalCopied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add this in Google or Apple Calendar to follow scheduled posts and key dates.
              </p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="dateline mb-1.5">Shareable report</p>
              {reportUrl ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input readOnly value={reportUrl} onFocus={(e) => e.target.select()} className="text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void navigator.clipboard.writeText(reportUrl)}
                    >
                      <Copy className="size-4" /> Copy
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={reportBusy !== null}
                      onClick={() => void report('recap')}
                    >
                      {reportBusy === 'recap' ? 'Writing…' : recapAt ? 'Refresh summary' : 'Write summary'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => void report('revoke')}
                      className="dateline text-[color:var(--pf-brick)]"
                    >
                      Turn off
                    </button>
                  </div>
                  {recapAt && (
                    <p className="text-xs text-muted-foreground">
                      Summary written {new Date(recapAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reportBusy !== null}
                  onClick={() => void report('setup')}
                >
                  {reportBusy === 'setup' ? 'Creating…' : 'Create a report link'}
                </Button>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                A read-only performance page — metrics update live; the summary is written on demand.
              </p>
            </div>
          </div>

          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save campaign settings'}
          </Button>
        </div>
      )}
    </div>
  );
}
