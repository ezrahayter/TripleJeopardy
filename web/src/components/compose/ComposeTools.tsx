import { useCallback, useEffect, useState } from 'react';
import { Hash, Link2, Loader2, Smile, Sparkles, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Snippet } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EMOJI =
  '👍 👏 🎉 🗳️ 📣 📢 💪 ❤️ 🔥 ✅ ⭐ 📅 📍 🙏 🤝 👀 💯 🚨 ⏰ 🇺🇸 🌹 ✊ 📊 📈 💬 🎯 ⚡ 🏛️ 🗓️ 📌 🙌 😊 🤔 💡 📰 🎤 🥳 ✨ 🫶 🧵'.split(
    ' ',
  );

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function ComposeTools({
  orgId,
  campaignId,
  campaignName,
  currentText,
  onInsert,
  onReplace,
}: {
  orgId: string;
  campaignId: string;
  campaignName: string;
  currentText: string;
  onInsert: (text: string) => void;
  onReplace: (text: string) => void;
}) {
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  async function ai(task: string, ctx: Record<string, unknown>, mode: 'replace' | 'insert') {
    if (!currentText.trim()) {
      toast.error('Write a note or a draft first.');
      return;
    }
    setAiBusy(task + JSON.stringify(ctx));
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: { task, input: currentText, context: ctx },
      });
      if (error) throw new Error(error.message);
      const out = (data as { text?: string; error?: string }) ?? {};
      if (out.error) throw new Error(out.error);
      if (out.text) (mode === 'replace' ? onReplace : onInsert)(out.text);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setAiBusy(null);
    }
  }

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newBody, setNewBody] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('snippets')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setSnippets(
      ((data as Snippet[]) ?? []).filter((s) => !s.campaign_id || s.campaign_id === campaignId),
    );
  }, [orgId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSnippet() {
    if (!newLabel.trim() || !newBody.trim()) return;
    const { error } = await supabase.from('snippets').insert({
      org_id: orgId,
      campaign_id: null,
      label: newLabel.trim(),
      body: newBody.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewLabel('');
    setNewBody('');
    await load();
    toast.success('Snippet saved');
  }

  async function deleteSnippet(id: string) {
    await supabase.from('snippets').delete().eq('id', id);
    await load();
  }

  const aiItems: { label: string; task: string; ctx: Record<string, unknown>; mode: 'replace' | 'insert' }[] = [
    { label: 'Write from my notes', task: 'caption', ctx: {}, mode: 'replace' },
    { label: 'Rewrite it', task: 'rewrite', ctx: {}, mode: 'replace' },
    { label: 'Make it punchier', task: 'tone', ctx: { tone: 'punchier and more urgent' }, mode: 'replace' },
    { label: 'Make it shorter', task: 'tone', ctx: { tone: 'shorter — half the length' }, mode: 'replace' },
    { label: 'Warmer tone', task: 'tone', ctx: { tone: 'warmer and more personal' }, mode: 'replace' },
    { label: 'Suggest hashtags', task: 'hashtags', ctx: {}, mode: 'insert' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* AI */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            AI
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          {aiItems.map((it) => (
            <button
              key={it.label}
              type="button"
              disabled={!!aiBusy}
              onClick={() => void ai(it.task, it.ctx, it.mode)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-50"
            >
              {aiBusy === it.task + JSON.stringify(it.ctx) && (
                <Loader2 className="size-3 animate-spin" />
              )}
              {it.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Snippets */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Hash className="size-3.5" /> Snippets
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          {snippets.length > 0 ? (
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {snippets.map((s) => (
                <li key={s.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onInsert(s.body)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs hover:border-input"
                  >
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block truncate text-muted-foreground">{s.body}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Delete snippet"
                    onClick={() => void deleteSnippet(s.id)}
                    className="mt-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No snippets yet — save a caption, disclaimer, or hashtag set to reuse it.
            </p>
          )}
          <div className="space-y-1.5 border-t border-border pt-3">
            <Label className="text-xs">New snippet</Label>
            <Input
              placeholder="Label (e.g. Event hashtags)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-xs"
            />
            <textarea
              placeholder="#HD69 #FlaPol #Herrmann"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={!newLabel.trim() || !newBody.trim()}
              onClick={() => void saveSnippet()}
            >
              <Plus className="size-3.5" /> Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Link + UTM */}
      <UtmBuilder campaignName={campaignName} onInsert={onInsert} />

      {/* Emoji */}
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Smile className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="grid grid-cols-8 gap-1">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onInsert(e)}
                className="grid size-7 place-items-center rounded text-lg hover:bg-secondary"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function UtmBuilder({
  campaignName,
  onInsert,
}: {
  campaignName: string;
  onInsert: (text: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('facebook');
  const [medium, setMedium] = useState('social');
  const [name, setName] = useState(slug(campaignName));

  let tagged = '';
  try {
    if (url.trim()) {
      const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`);
      if (source) u.searchParams.set('utm_source', source);
      if (medium) u.searchParams.set('utm_medium', medium);
      if (name) u.searchParams.set('utm_campaign', name);
      tagged = u.toString();
    }
  } catch {
    tagged = '';
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Link2 className="size-3.5" /> Link
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2.5" align="start">
        <Label className="text-xs">Add a tracked link</Label>
        <Input
          placeholder="secure.actblue.com/donate/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-3 gap-1.5">
          <Input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="source"
            className="h-8 text-xs"
          />
          <Input
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="medium"
            className="h-8 text-xs"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="campaign"
            className="h-8 text-xs"
          />
        </div>
        {tagged && (
          <p className="break-all rounded-md border border-border bg-secondary/40 p-2 text-[11px]">
            {tagged}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={!tagged}
          onClick={() => onInsert(tagged)}
        >
          Insert link
        </Button>
      </PopoverContent>
    </Popover>
  );
}
