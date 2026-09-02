import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, Rss, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Feed {
  id: string;
  url: string;
  label: string | null;
  last_checked_at: string | null;
  last_error: string | null;
}

export function CampaignFeeds({ campaignId, orgId }: { campaignId: string; orgId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Feed[]>([]);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('campaign_feeds')
      .select('id, url, label, last_checked_at, last_error')
      .eq('campaign_id', campaignId)
      .order('created_at');
    setRows((data as Feed[]) ?? []);
  }, [campaignId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!/^https?:\/\//i.test(url.trim())) {
      toast.error('Enter a full feed URL (https://…).');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('campaign_feeds').insert({
      org_id: orgId,
      campaign_id: campaignId,
      url: url.trim(),
      label: label.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUrl('');
    setLabel('');
    await load();
  }

  async function remove(id: string) {
    await supabase.from('campaign_feeds').delete().eq('id', id);
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
        <Rss className="size-3" />
        RSS to drafts{rows.length ? ` · ${rows.length}` : ''}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            New items from these feeds land as draft posts (up to 3 per feed per check). The first
            check just catalogues what's already there.
          </p>

          {rows.length > 0 && (
            <ul className="space-y-1.5">
              {rows.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{f.label || f.url}</span>
                    <span className="dateline">
                      {f.last_error
                        ? `Error: ${f.last_error}`
                        : f.last_checked_at
                          ? `Checked ${new Date(f.last_checked_at).toLocaleString()}`
                          : 'Not checked yet'}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Remove feed"
                    onClick={() => void remove(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={add} className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor={`feed-url-${campaignId}`} className="sr-only">
                Feed URL
              </Label>
              <Input
                id={`feed-url-${campaignId}`}
                placeholder="https://example.com/feed.xml"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Label (optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={busy}>
                Add feed
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
