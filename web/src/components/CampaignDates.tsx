import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { CampaignDate, CampaignDateKind } from '@shared/types';
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

const KINDS: { value: CampaignDateKind; label: string }[] = [
  { value: 'election', label: 'Election' },
  { value: 'filing', label: 'Filing deadline' },
  { value: 'debate', label: 'Debate' },
  { value: 'fundraising', label: 'Fundraising deadline' },
  { value: 'milestone', label: 'Milestone' },
];

function fmt(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CampaignDates({ campaignId, orgId }: { campaignId: string; orgId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CampaignDate[]>([]);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [kind, setKind] = useState<CampaignDateKind>('milestone');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('campaign_dates')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date');
    setRows((data as CampaignDate[]) ?? []);
  }, [campaignId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !date) return;
    setBusy(true);
    const { error } = await supabase.from('campaign_dates').insert({
      org_id: orgId,
      campaign_id: campaignId,
      label: label.trim(),
      date,
      kind,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLabel('');
    setDate('');
    setKind('milestone');
    await load();
  }

  async function remove(id: string) {
    await supabase.from('campaign_dates').delete().eq('id', id);
    await load();
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="dateline flex items-center gap-1"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <CalendarClock className="size-3" />
        Key dates{rows.length ? ` · ${rows.length}` : ''}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Election day, filing deadlines, debates — shown as anchors on the calendar.
          </p>

          {rows.length > 0 && (
            <ul className="space-y-1.5">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  <span className="dateline w-24 shrink-0">{fmt(r.date)}</span>
                  <span className="flex-1 truncate">{r.label}</span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => void remove(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="space-y-1">
              <Label htmlFor={`kd-label-${campaignId}`} className="sr-only">
                Label
              </Label>
              <Input
                id={`kd-label-${campaignId}`}
                placeholder="Primary election"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
            />
            <Select value={kind} onValueChange={(v) => setKind(v as CampaignDateKind)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" disabled={busy || !label.trim() || !date}>
              Add
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
