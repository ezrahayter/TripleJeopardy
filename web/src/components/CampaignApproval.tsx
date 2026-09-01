import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
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
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ApprovalMode>(campaign.approval_mode);
  const [name, setName] = useState(campaign.approver_name ?? '');
  const [email, setEmail] = useState(campaign.approver_email ?? '');
  const [waived, setWaived] = useState<string[]>(campaign.waived_networks ?? []);
  const [disclaimer, setDisclaimer] = useState(campaign.disclaimer ?? '');
  const [busy, setBusy] = useState(false);

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
                <Label htmlFor={`ae-${campaign.id}`}>Their email (for your reference)</Label>
                <Input
                  id={`ae-${campaign.id}`}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
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

          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save campaign settings'}
          </Button>
        </div>
      )}
    </div>
  );
}
