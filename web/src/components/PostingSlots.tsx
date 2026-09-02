import { useState, type FormEvent } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PostingSlot } from '@shared/types';
import { DOW } from '@/lib/postingSlots';
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

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function sortSlots(s: PostingSlot[]) {
  return [...s].sort((a, b) => a.dow - b.dow || a.time.localeCompare(b.time));
}

export function PostingSlots({
  campaignId,
  slots,
  onSave,
}: {
  campaignId: string;
  slots: PostingSlot[];
  onSave: (slots: PostingSlot[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [dow, setDow] = useState('1');
  const [time, setTime] = useState('09:00');
  const [busy, setBusy] = useState(false);

  async function commit(next: PostingSlot[]) {
    setBusy(true);
    try {
      await onSave(sortSlots(next));
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const slot = { dow: Number(dow), time };
    if (slots.some((s) => s.dow === slot.dow && s.time === slot.time)) {
      toast.error('That slot is already in the list.');
      return;
    }
    await commit([...slots, slot]);
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
        Posting slots{slots.length ? ` · ${slots.length}` : ''}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Recurring times the composer offers as the next open slot. Times are read in your
            local zone.
          </p>

          {slots.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {sortSlots(slots).map((s) => (
                <li
                  key={`${s.dow}-${s.time}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-2.5 pr-1.5 text-xs"
                >
                  {DOW[s.dow]} {fmtTime(s.time)}
                  <button
                    type="button"
                    aria-label="Remove slot"
                    disabled={busy}
                    onClick={() =>
                      void commit(slots.filter((x) => !(x.dow === s.dow && x.time === s.time)))
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`ps-dow-${campaignId}`} className="sr-only">
                Day
              </Label>
              <Select value={dow} onValueChange={setDow}>
                <SelectTrigger id={`ps-dow-${campaignId}`} className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOW.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-32"
            />
            <Button type="submit" size="sm" disabled={busy}>
              Add slot
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
