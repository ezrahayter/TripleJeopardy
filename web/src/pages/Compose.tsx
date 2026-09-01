import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Campaign, PostStatus } from '@shared/types';
import { isoToLocalInput } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ExistingMedia {
  id: string;
  path: string;
  url: string;
}

type Mode = 'draft' | 'schedule' | 'now';
const MAX_IMAGES = 4;

export function Compose({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [params] = useSearchParams();

  const [loaded, setLoaded] = useState(!editId);
  const [origApproval, setOrigApproval] = useState<string>('not_required');
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existing, setExisting] = useState<ExistingMedia[]>([]);
  const [scheduleAt, setScheduleAt] = useState(() => isoToLocalInput(params.get('at')));
  const [hasAccounts, setHasAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chars = [...body].length;
  const totalImages = existing.length + files.length;

  const loadExistingMedia = useCallback(async (postId: string) => {
    const { data: rows } = await supabase
      .from('post_media')
      .select('id, storage_path')
      .eq('post_id', postId)
      .order('sort');
    const paths = (rows ?? []).map((r) => r.storage_path as string);
    if (paths.length === 0) {
      setExisting([]);
      return;
    }
    const { data: signed } = await supabase.storage.from('media').createSignedUrls(paths, 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));
    setExisting(
      (rows ?? []).map((r) => ({
        id: r.id as string,
        path: r.storage_path as string,
        url: urlByPath.get(r.storage_path as string) ?? '',
      })),
    );
  }, []);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('body, status, approval_state, campaign_id, scheduled_at')
        .eq('id', editId)
        .single();
      if (error || !data) {
        setError('Could not load that post.');
        setLoaded(true);
        return;
      }
      setBody(data.body ?? '');
      setCampaignId(data.campaign_id as string);
      setScheduleAt(isoToLocalInput(data.scheduled_at as string | null));
      setOrigApproval((data.approval_state as string) ?? 'not_required');
      void (data.status as PostStatus);
      await loadExistingMedia(editId);
      setLoaded(true);
    })();
  }, [editId, loadExistingMedia]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (!campaignId) return;
    void supabase
      .from('social_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .then(({ count }) => setHasAccounts((count ?? 0) > 0));
  }, [campaignId]);

  function addFiles(list: FileList | null) {
    const room = MAX_IMAGES - existing.length - files.length;
    if (room <= 0) return;
    setFiles((prev) => [...prev, ...Array.from(list ?? []).slice(0, room)]);
  }

  async function removeExisting(m: ExistingMedia) {
    setBusy(true);
    await supabase.storage.from('media').remove([m.path]);
    await supabase.from('post_media').delete().eq('id', m.id);
    setExisting((xs) => xs.filter((x) => x.id !== m.id));
    setBusy(false);
  }

  async function save(mode: Mode) {
    setError(null);
    if (!body.trim() && totalImages === 0) {
      setError('Add some text or an image.');
      return;
    }
    if (!campaignId) {
      setError('Pick a campaign.');
      return;
    }
    if (mode === 'schedule' && !scheduleAt) {
      setError('Pick a date and time.');
      return;
    }

    setBusy(true);
    try {
      let postId = editId ?? '';
      if (editId) {
        const { error } = await supabase
          .from('posts')
          .update({ body, campaign_id: campaignId })
          .eq('id', editId);
        if (error) throw error;
        if (origApproval !== 'not_required') {
          await supabase.rpc('tj_reset_approval', { p_post_id: editId });
        }
      } else {
        const { data, error } = await supabase
          .from('posts')
          .insert({ org_id: orgId, campaign_id: campaignId, body, status: 'draft' })
          .select('id')
          .single();
        if (error || !data) throw error ?? new Error('could not create post');
        postId = data.id as string;
      }

      const base = existing.length;
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${campaignId}/${postId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: mErr } = await supabase
          .from('post_media')
          .insert({ post_id: postId, storage_path: path, sort: base + i, alt_text: '' });
        if (mErr) throw mErr;
      }

      if (mode === 'draft') {
        await supabase.from('posts').update({ status: 'draft', scheduled_at: null }).eq('id', postId);
        toast.success('Saved as draft');
      } else {
        const when =
          mode === 'schedule' ? new Date(scheduleAt).toISOString() : new Date().toISOString();
        await supabase
          .from('posts')
          .update({ status: 'scheduled', scheduled_at: when })
          .eq('id', postId);
        toast.success(mode === 'now' ? 'Queued to publish' : 'Added to the calendar');
      }

      navigate(mode === 'draft' ? '/posts' : '/');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <>
      <PageHeader
        title={editId ? 'Edit post' : 'Compose'}
        description={
          hasAccounts
            ? 'Publishes automatically to this campaign’s connected accounts at the scheduled time.'
            : 'Nothing’s connected for this campaign yet — this sits on the calendar as a plan until you connect accounts.'
        }
      />

      <div className="max-w-xl space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="campaign">Campaign</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger id="campaign" className="w-full">
              <SelectValue placeholder="Pick a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="body">Text</Label>
            <span
              className={`dateline ${chars > 300 ? '!text-destructive' : ''}`}
            >
              {chars} characters
            </span>
          </div>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
          <p className="dateline">
            Bluesky 300 · Threads 500 · Instagram 2,200 · Facebook long
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="images">
            Images ({totalImages}/{MAX_IMAGES})
          </Label>
          {totalImages < MAX_IMAGES && (
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              className="cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          )}
          {(existing.length > 0 || files.length > 0) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {existing.map((m) => (
                <Thumb key={m.id} src={m.url} disabled={busy} onRemove={() => void removeExisting(m)} />
              ))}
              {files.map((f, i) => (
                <Thumb
                  key={`new-${i}`}
                  src={previews[i] ?? ''}
                  alt={f.name}
                  onRemove={() => setFiles(files.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="when">Date &amp; time on the calendar</Label>
          <Input
            id="when"
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" disabled={busy} onClick={() => void save('draft')}>
            Save as draft
          </Button>
          <Button disabled={busy || !scheduleAt} onClick={() => void save('schedule')}>
            {busy ? 'Working…' : editId ? 'Save to calendar' : 'Add to calendar'}
          </Button>
          {hasAccounts && (
            <Button variant="action" disabled={busy} onClick={() => void save('now')}>
              Publish now
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Thumb({
  src,
  alt = '',
  disabled,
  onRemove,
}: {
  src: string;
  alt?: string;
  disabled?: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      <img
        src={src}
        alt={alt}
        className="size-24 rounded-md border border-input object-cover"
      />
      <button
        type="button"
        aria-label="Remove image"
        disabled={disabled}
        onClick={onRemove}
        className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border border-primary bg-background text-foreground"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
