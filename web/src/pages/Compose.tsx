import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Campaign, PostStatus, PostType } from '@shared/types';
import {
  ALL_NETWORKS,
  NETWORKS,
  countGraphemes,
  type NetworkId,
} from '@/lib/networks';
import { PageHeader } from '@/components/PageHeader';
import { NetworkPicker } from '@/components/compose/NetworkPicker';
import { PostPreview, type PreviewAccount } from '@/components/compose/PostPreview';
import { SchedulePicker } from '@/components/compose/SchedulePicker';
import { MediaDropzone, type MediaItem } from '@/components/compose/MediaDropzone';
import { ComposeTools } from '@/components/compose/ComposeTools';
import { Button } from '@/components/ui/button';
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
  alt: string;
}

type Mode = 'draft' | 'schedule' | 'now';
const MAX_IMAGES = 4;
const ALL_IDS = ALL_NETWORKS.map((n) => n.id);

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
  const [scheduleAt, setScheduleAt] = useState<Date | null>(() => {
    const at = params.get('at');
    const d = at ? new Date(at) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  });
  const [accounts, setAccounts] = useState<
    Array<{ network: string; handle: string; meta: Record<string, unknown> }>
  >([]);
  const [selected, setSelected] = useState<NetworkId[]>(ALL_IDS);
  const [firstComment, setFirstComment] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [alts, setAlts] = useState<Record<string, string>>({});
  const [postType, setPostType] = useState<PostType>('standard');
  const [linkUrl, setLinkUrl] = useState('');
  const [fundGoal, setFundGoal] = useState('');
  const [needsSource, setNeedsSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [fromLink, setFromLink] = useState('');
  const [fromBusy, setFromBusy] = useState(false);
  const [rapidBusy, setRapidBusy] = useState(false);
  const [rapidOptions, setRapidOptions] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overridesOpen, setOverridesOpen] = useState(false);
  const [useDisclaimer, setUseDisclaimer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalImages = existing.length + files.length;
  const hasAccounts = accounts.length > 0;
  const campaign = campaigns.find((c) => c.id === campaignId);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertIntoBody = useCallback((text: string) => {
    const el = bodyRef.current;
    setBody((prev) => {
      const start = el?.selectionStart ?? prev.length;
      const end = el?.selectionEnd ?? prev.length;
      const pad = start > 0 && !/\s$/.test(prev.slice(0, start)) ? ' ' : '';
      const next = prev.slice(0, start) + pad + text + prev.slice(end);
      queueMicrotask(() => {
        el?.focus();
        const pos = start + pad.length + text.length;
        el?.setSelectionRange(pos, pos);
      });
      return next;
    });
  }, []);
  async function draftRapid() {
    if (!body.trim()) {
      toast.error('Describe what happened first — a headline or a few notes.');
      return;
    }
    setRapidBusy(true);
    setRapidOptions([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: { task: 'rapid', input: body },
      });
      if (error) throw new Error(error.message);
      const out = (data as { options?: string[]; error?: string }) ?? {};
      if (out.error) throw new Error(out.error);
      setRapidOptions(out.options ?? []);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setRapidBusy(false);
    }
  }

  async function pullFromLink() {
    setFromBusy(true);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(
        `${base}/functions/v1/og-fetch?url=${encodeURIComponent(fromLink.trim())}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string } },
      );
      const og = (await res.json()) as {
        title?: string;
        description?: string;
        error?: string;
      };
      if (!res.ok || og.error) {
        toast.error(og.error ?? 'Could not read that link.');
      } else {
        const parts = [og.title, og.description].filter(Boolean);
        setBody(parts.join('\n\n'));
        setLinkUrl(fromLink.trim());
        setFromLink('');
        toast.success('Drafted from the link');
      }
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setFromBusy(false);
    }
  }

  const disclaimer = campaign?.disclaimer?.trim() ?? '';

  /** body as it will be saved — disclaimer appended once, if opted in */
  const finalBody = useMemo(() => {
    if (!useDisclaimer || !disclaimer) return body;
    return body.includes(disclaimer) ? body : `${body.trimEnd()}\n\n${disclaimer}`;
  }, [body, useDisclaimer, disclaimer]);

  const available: NetworkId[] = useMemo(() => {
    const connected = [...new Set(accounts.map((a) => a.network))].filter((n): n is NetworkId =>
      ALL_IDS.includes(n as NetworkId),
    );
    return connected.length > 0 ? connected : ALL_IDS;
  }, [accounts]);

  const previewAccounts: Record<string, PreviewAccount | undefined> = useMemo(() => {
    const campaignName = campaigns.find((c) => c.id === campaignId)?.name ?? 'Your campaign';
    const out: Record<string, PreviewAccount | undefined> = {};
    for (const a of accounts) {
      const meta = a.meta ?? {};
      out[a.network] = {
        network: a.network as NetworkId,
        name:
          (meta.page_name as string) ||
          (meta.ig_username as string) ||
          campaignName,
        handle: a.handle,
      };
    }
    return out;
  }, [accounts, campaignId, campaigns]);

  const mediaUrls = useMemo(
    () => [...existing.map((e) => e.url), ...previews],
    [existing, previews],
  );

  const activeSelected = selected.filter((s) => available.includes(s));
  const textFor = (id: NetworkId) => overrides[id]?.trim() || finalBody;
  const overLimit = activeSelected.filter((id) => countGraphemes(textFor(id)) > NETWORKS[id].limit);

  const loadExistingMedia = useCallback(async (postId: string) => {
    const { data: rows } = await supabase
      .from('post_media')
      .select('id, storage_path, alt_text')
      .eq('post_id', postId)
      .order('sort');
    const paths = (rows ?? []).map((r) => r.storage_path as string);
    if (paths.length === 0) {
      setExisting([]);
      return;
    }
    const { data: signed } = await supabase.storage.from('media').createSignedUrls(paths, 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl]));
    const list = (rows ?? []).map((r) => ({
      id: r.id as string,
      path: r.storage_path as string,
      url: urlByPath.get(r.storage_path as string) ?? '',
      alt: (r.alt_text as string) ?? '',
    }));
    setExisting(list);
    setAlts((a) => {
      const next = { ...a };
      for (const m of list) if (next[`e:${m.id}`] === undefined) next[`e:${m.id}`] = m.alt;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!editId) return;
    void (async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('body, status, approval_state, campaign_id, scheduled_at, first_comment, internal_note, post_type, link_url, fundraise_goal, needs_source, source_url, body_overrides')
        .eq('id', editId)
        .single();
      if (error || !data) {
        setError('Could not load that post.');
        setLoaded(true);
        return;
      }
      setBody(data.body ?? '');
      setFirstComment((data.first_comment as string) ?? '');
      setInternalNote((data.internal_note as string) ?? '');
      setPostType(((data.post_type as PostType) ?? 'standard'));
      setLinkUrl((data.link_url as string) ?? '');
      setFundGoal(data.fundraise_goal != null ? String(data.fundraise_goal) : '');
      setNeedsSource(!!data.needs_source);
      setSourceUrl((data.source_url as string) ?? '');
      const ov = (data.body_overrides as Record<string, string>) ?? {};
      setOverrides(ov);
      if (Object.keys(ov).length > 0) setOverridesOpen(true);
      setUseDisclaimer(false); // editing: don't silently re-append
      setCampaignId(data.campaign_id as string);
      const s = data.scheduled_at ? new Date(data.scheduled_at as string) : null;
      setScheduleAt(s && !Number.isNaN(s.getTime()) ? s : null);
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
    if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  useEffect(() => {
    if (!campaignId) return;
    void supabase
      .from('social_accounts')
      .select('network, handle, meta')
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .then(({ data }) => {
        const rows = (data as typeof accounts) ?? [];
        setAccounts(rows);
        const nets = [...new Set(rows.map((r) => r.network))].filter((n): n is NetworkId =>
          ALL_IDS.includes(n as NetworkId),
        );
        setSelected(nets.length > 0 ? nets : ALL_IDS);
      });
  }, [campaignId]);

  function toggleNetwork(id: NetworkId) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function addFiles(list: File[]) {
    const room = MAX_IMAGES - existing.length - files.length;
    if (room <= 0) return;
    setFiles((prev) => [...prev, ...list.slice(0, room)]);
  }

  async function removeMedia(key: string) {
    if (key.startsWith('e:')) {
      const id = key.slice(2);
      const m = existing.find((x) => x.id === id);
      if (!m) return;
      setBusy(true);
      await supabase.storage.from('media').remove([m.path]);
      await supabase.from('post_media').delete().eq('id', m.id);
      setExisting((xs) => xs.filter((x) => x.id !== id));
      setBusy(false);
    } else {
      const idx = Number(key.slice(2));
      setFiles((fs) => fs.filter((_, i) => i !== idx));
    }
  }

  const mediaItems: MediaItem[] = [
    ...existing.map((e) => ({ key: `e:${e.id}`, url: e.url, alt: alts[`e:${e.id}`] ?? '', removing: busy })),
    ...files.map((f, i) => ({ key: `f:${i}`, url: previews[i] ?? '', name: f.name, alt: alts[`f:${i}`] ?? '' })),
  ];

  const setAlt = (key: string, alt: string) => setAlts((a) => ({ ...a, [key]: alt }));

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
    if (mode !== 'draft' && overLimit.length > 0) {
      setError(`Too long for ${overLimit.map((n) => NETWORKS[n].label).join(', ')}.`);
      return;
    }

    // keep only non-empty overrides for networks in play
    const cleanOverrides: Record<string, string> = {};
    for (const id of activeSelected) {
      const v = overrides[id]?.trim();
      if (v) cleanOverrides[id] = v;
    }
    if (needsSource && !sourceUrl.trim()) {
      setError('This post is marked as needing a source — add one before saving.');
      return;
    }
    const fields = {
      body: finalBody,
      campaign_id: campaignId,
      first_comment: firstComment.trim() || null,
      internal_note: internalNote.trim() || null,
      post_type: postType,
      link_url: linkUrl.trim() || null,
      fundraise_goal: postType === 'fundraising' && fundGoal ? Number(fundGoal) : null,
      needs_source: needsSource,
      source_url: sourceUrl.trim() || null,
      body_overrides: cleanOverrides,
    };

    setBusy(true);
    try {
      let postId = editId ?? '';
      if (editId) {
        const { error } = await supabase.from('posts').update(fields).eq('id', editId);
        if (error) throw error;
        if (origApproval !== 'not_required') {
          await supabase.rpc('tj_reset_approval', { p_post_id: editId });
        }
      } else {
        const { data, error } = await supabase
          .from('posts')
          .insert({ org_id: orgId, status: 'draft', ...fields })
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
          .insert({ post_id: postId, storage_path: path, sort: base + i, alt_text: alts[`f:${i}`]?.trim() ?? '' });
        if (mErr) throw mErr;
      }

      for (const m of existing) {
        const a = (alts[`e:${m.id}`] ?? '').trim();
        if (a !== m.alt) await supabase.from('post_media').update({ alt_text: a }).eq('id', m.id);
      }

      if (mode === 'draft') {
        await supabase.from('posts').update({ status: 'draft', scheduled_at: null }).eq('id', postId);
        toast.success('Saved as draft');
      } else {
        const when = (mode === 'schedule' ? scheduleAt! : new Date()).toISOString();
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
            ? 'Publishes to this campaign’s connected accounts at the scheduled time.'
            : 'No accounts connected for this campaign yet — this plans the post on the calendar.'
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
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

          {!editId && !body.trim() && (
            <div className="space-y-1.5">
              <Label htmlFor="from-link">Start from a link</Label>
              <div className="flex gap-2">
                <input
                  id="from-link"
                  value={fromLink}
                  onChange={(e) => setFromLink(e.target.value)}
                  placeholder="Paste an article or event URL"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={fromBusy || !/^https?:\/\//i.test(fromLink.trim())}
                  onClick={() => void pullFromLink()}
                >
                  {fromBusy ? '…' : 'Pull'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {hasAccounts ? 'Post to' : 'Preview for'}
            </Label>
            <NetworkPicker
              available={available}
              selected={activeSelected}
              onToggle={toggleNetwork}
              text={body}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Text</Label>
              <ComposeTools
                orgId={orgId}
                campaignId={campaignId}
                campaignName={campaign?.name ?? 'Your campaign'}
                currentText={body}
                onInsert={insertIntoBody}
                onReplace={setBody}
              />
            </div>
            <Textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="What’s the message?"
            />
            {overLimit.length > 0 && (
              <p className="text-xs text-destructive">
                Over the limit for {overLimit.map((n) => NETWORKS[n].label).join(', ')}.
              </p>
            )}
            {disclaimer && (
              <label className="flex cursor-pointer items-start gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  checked={useDisclaimer}
                  onChange={(e) => setUseDisclaimer(e.target.checked)}
                  className="mt-0.5 accent-[color:var(--pf-coral)]"
                />
                <span>
                  Append disclaimer
                  <span className="dateline ml-2 normal-case">“{disclaimer}”</span>
                </span>
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setOverridesOpen((o) => !o)}
              className="dateline flex items-center gap-1"
            >
              {overridesOpen ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              Customize text per network
              {Object.values(overrides).some(Boolean) && ' · edited'}
            </button>
            {overridesOpen && (
              <div className="space-y-3 pt-1">
                {activeSelected.map((id) => {
                  const meta = NETWORKS[id];
                  const val = overrides[id] ?? '';
                  const count = countGraphemes(val || finalBody);
                  return (
                    <div key={id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="dateline flex items-center gap-1.5">
                          <meta.icon className="size-3.5" /> {meta.label}
                        </span>
                        <span
                          className={cn(
                            'dateline tabular-nums',
                            count > meta.limit && '!text-destructive',
                          )}
                        >
                          {count}/{meta.limit}
                        </span>
                      </div>
                      <Textarea
                        rows={2}
                        value={val}
                        onChange={(e) =>
                          setOverrides((o) => ({ ...o, [id]: e.target.value }))
                        }
                        placeholder={`Uses the shared text unless you write a ${meta.label} version`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="first-comment">First comment</Label>
            <Textarea
              id="first-comment"
              rows={2}
              value={firstComment}
              onChange={(e) => setFirstComment(e.target.value)}
              placeholder="Posted as the first reply — links, sources, hashtags"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="internal-note">Team note</Label>
            <p className="text-xs text-muted-foreground">
              Context for your team — never shown to the candidate.
            </p>
            <Textarea
              id="internal-note"
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="e.g. hold until the endorsement is public"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-type">Post type</Label>
              <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                <SelectTrigger id="post-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="fundraising">Fundraising</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="rapid_response">Rapid response</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(postType === 'fundraising' || postType === 'event') && (
              <div className="space-y-1.5">
                <Label htmlFor="link-url">
                  {postType === 'fundraising' ? 'Donate link' : 'RSVP link'}
                </Label>
                <input
                  id="link-url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={
                    postType === 'fundraising' ? 'secure.actblue.com/donate/…' : 'mobilize.us/…'
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                />
              </div>
            )}
            {postType === 'fundraising' && (
              <div className="space-y-1.5">
                <Label htmlFor="fund-goal">Goal ($)</Label>
                <input
                  id="fund-goal"
                  type="number"
                  min={0}
                  value={fundGoal}
                  onChange={(e) => setFundGoal(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                />
              </div>
            )}
          </div>

          {postType === 'rapid_response' && (
            <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Draft rapid-response options</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={rapidBusy}
                  onClick={() => void draftRapid()}
                >
                  {rapidBusy ? 'Drafting…' : 'Draft 3 options'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uses the text above as the situation. Pick one to load it into the post.
              </p>
              {rapidOptions.length > 0 && (
                <ul className="space-y-1.5">
                  {rapidOptions.map((opt, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => {
                          setBody(opt);
                          setRapidOptions([]);
                        }}
                        className="w-full whitespace-pre-wrap rounded-md border border-border bg-background p-2.5 text-left text-[13px] hover:border-input"
                      >
                        {opt}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={needsSource}
                onChange={(e) => setNeedsSource(e.target.checked)}
                className="accent-[color:var(--pf-coral)]"
              />
              Makes a factual claim — needs a source before review
            </label>
            {needsSource && (
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Link to the source"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Images ({totalImages}/{MAX_IMAGES})</Label>
            <MediaDropzone
              items={mediaItems}
              max={MAX_IMAGES}
              onAdd={addFiles}
              onAltChange={setAlt}
              onRemove={removeMedia}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Schedule</Label>
            <SchedulePicker value={scheduleAt} onChange={setScheduleAt} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="secondary" disabled={busy} onClick={() => void save('draft')}>
              Save as draft
            </Button>
            <Button
              disabled={busy || !scheduleAt || overLimit.length > 0}
              onClick={() => void save('schedule')}
            >
              {busy ? 'Working…' : editId ? 'Save to calendar' : 'Add to calendar'}
            </Button>
            {hasAccounts && (
              <Button
                variant="action"
                disabled={busy || overLimit.length > 0}
                onClick={() => void save('now')}
              >
                Publish now
              </Button>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-8 lg:self-start">
          <PostPreview
            networks={activeSelected}
            accounts={previewAccounts}
            text={finalBody}
            overrides={overrides}
            firstComment={firstComment}
            mediaUrls={mediaUrls}
          />
        </div>
      </div>
    </>
  );
}
