import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Campaign } from '@shared/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// minimal RFC-4180-ish parser: handles quoted fields with commas + newlines
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

interface Parsed {
  text: string;
  scheduledAt: string | null;
  error?: string;
}

export function BulkImport({
  orgId,
  campaigns,
  onDone,
}: {
  orgId: string;
  campaigns: Campaign[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const parsed = useMemo<Parsed[]>(() => {
    const rows = parseCsv(raw.trim());
    if (rows.length === 0) return [];
    const header = rows[0]!.map((h) => h.trim().toLowerCase());
    const hasHeader = header.includes('text') || header.includes('body');
    const ti = hasHeader ? Math.max(header.indexOf('text'), header.indexOf('body')) : 0;
    const di = hasHeader ? header.indexOf('date') : 1;
    const si = hasHeader ? header.indexOf('time') : 2;
    const body = hasHeader ? rows.slice(1) : rows;

    return body.map((r) => {
      const text = (r[ti] ?? '').trim();
      const date = di >= 0 ? (r[di] ?? '').trim() : '';
      const time = si >= 0 ? (r[si] ?? '').trim() : '';
      let scheduledAt: string | null = null;
      let error: string | undefined;
      if (!text) error = 'no text';
      if (date) {
        const d = new Date(`${date}${time ? ` ${time}` : ' 09:00'}`);
        if (Number.isNaN(d.getTime())) error = error ?? 'bad date';
        else scheduledAt = d.toISOString();
      }
      return { text, scheduledAt, error };
    });
  }, [raw]);

  const ok = parsed.filter((p) => !p.error);

  async function importAll() {
    if (!campaignId || ok.length === 0) return;
    setBusy(true);
    const rows = ok.map((p) => ({
      org_id: orgId,
      campaign_id: campaignId,
      body: p.text,
      status: p.scheduledAt ? ('scheduled' as const) : ('draft' as const),
      approval_state: 'not_required' as const,
      scheduled_at: p.scheduledAt,
    }));
    const { error } = await supabase.from('posts').insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Imported ${rows.length} post${rows.length > 1 ? 's' : ''}`);
    setRaw('');
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import posts</DialogTitle>
          <DialogDescription>
            Paste CSV with a <code>text</code> column, optionally <code>date</code> and{' '}
            <code>time</code>. Rows with a date come in scheduled (unapproved); the rest as drafts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger>
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={'text,date,time\n"GOTV push — polls open at 7am",2026-11-03,08:00\nEndorsed by the teachers union today,,'}
            className="w-full rounded-md border border-input bg-transparent p-2.5 font-mono text-xs"
          />

          {parsed.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {ok.length} ready
              {parsed.length - ok.length > 0 && `, ${parsed.length - ok.length} skipped`}
            </p>
          )}

          <Button
            className="w-full"
            disabled={busy || !campaignId || ok.length === 0}
            onClick={() => void importAll()}
          >
            {busy ? 'Importing…' : `Import ${ok.length} post${ok.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
