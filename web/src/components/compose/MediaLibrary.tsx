import { useCallback, useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LibItem {
  path: string;
  url: string;
  alt: string;
}

export function MediaLibrary({
  campaignId,
  disabled,
  onPick,
}: {
  campaignId: string;
  disabled?: boolean;
  onPick: (item: { path: string; url: string; alt: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from('post_media')
      .select('storage_path, alt_text, created_at, post:posts!inner(campaign_id)')
      .eq('post.campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(120);
    const seen = new Set<string>();
    const paths: string[] = [];
    const altByPath = new Map<string, string>();
    for (const r of (rows as unknown as { storage_path: string; alt_text: string | null }[]) ?? []) {
      if (seen.has(r.storage_path)) continue;
      seen.add(r.storage_path);
      paths.push(r.storage_path);
      altByPath.set(r.storage_path, r.alt_text ?? '');
    }
    const { data: signed } = await supabase.storage.from('media').createSignedUrls(paths.slice(0, 60), 3600);
    const next: LibItem[] = [];
    for (const s of signed ?? []) {
      if (s.error || !s.signedUrl) continue;
      next.push({ path: s.path ?? '', url: s.signedUrl, alt: altByPath.get(s.path ?? '') ?? '' });
    }
    setItems(next);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          <ImageIcon className="size-3.5" /> From library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reuse an image</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No images used on this campaign yet.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {items.map((it) => (
              <button
                key={it.path}
                type="button"
                onClick={() => {
                  onPick(it);
                  setOpen(false);
                }}
                className="group relative aspect-square overflow-hidden rounded-md border border-border hover:border-primary"
              >
                <img src={it.url} alt={it.alt} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
