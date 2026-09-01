import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { ApprovalMode, Campaign } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ApprovalMode>(campaign.approval_mode);
  const [name, setName] = useState(campaign.approver_name ?? '');
  const [email, setEmail] = useState(campaign.approver_email ?? '');
  const [busy, setBusy] = useState(false);

  const summary =
    campaign.approval_mode === 'waived'
      ? 'Approval waived'
      : `${campaign.approval_mode === 'candidate' ? 'Candidate approves' : 'Designated approver'}${
          campaign.approver_name ? ` · ${campaign.approver_name}` : ''
        }`;

  async function save() {
    setBusy(true);
    try {
      await onSave({
        approval_mode: mode,
        approver_name: mode === 'waived' ? null : name,
        approver_email: mode === 'waived' ? null : email,
      });
      toast.success('Approval settings saved');
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
        <div className="mt-3 space-y-3">
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
            </>
          )}

          <Button size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save approval settings'}
          </Button>
        </div>
      )}
    </div>
  );
}
