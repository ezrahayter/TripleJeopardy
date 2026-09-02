import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { PostComment } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function PostComments({ postId, orgId }: { postId: string; orgId: string }) {
  const [rows, setRows] = useState<PostComment[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at');
    setRows((data as PostComment[]) ?? []);
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('post_comments').insert({
      org_id: orgId,
      post_id: postId,
      author: 'operator',
      body: body.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody('');
    await load();
  }

  async function toggleResolved(c: PostComment) {
    await supabase.from('post_comments').update({ resolved: !c.resolved }).eq('id', c.id);
    await load();
  }

  const open = rows.filter((c) => !c.resolved);
  const resolved = rows.filter((c) => c.resolved);
  const shown = showResolved ? rows : open;

  return (
    <div className="space-y-3">
      {shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((c) => (
            <li
              key={c.id}
              className={`rounded-md border border-border bg-card p-2.5 text-sm ${
                c.resolved ? 'opacity-60' : ''
              }`}
            >
              <div className="dateline flex items-center justify-between">
                <span>
                  {c.author === 'reviewer' ? c.author_name ?? 'Reviewer' : 'You'} ·{' '}
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  onClick={() => void toggleResolved(c)}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  <Check className="size-3" />
                  {c.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {open.length === 0 && !showResolved && (
        <p className="text-xs text-muted-foreground">No open comments.</p>
      )}

      {resolved.length > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((s) => !s)}
          className="dateline"
        >
          {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
        </button>
      )}

      <div className="space-y-1.5">
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Leave a note on this draft…"
        />
        <Button size="sm" disabled={busy || !body.trim()} onClick={() => void add()}>
          Comment
        </Button>
      </div>
    </div>
  );
}
