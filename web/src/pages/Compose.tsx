import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Campaign, PostStatus } from '@shared/types';

interface ExistingMedia {
  id: string;
  path: string;
  url: string;
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
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
        // content changed after it was sent/approved -> reset sign-off
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
      } else {
        const when =
          mode === 'schedule' ? new Date(scheduleAt).toISOString() : new Date().toISOString();
        await supabase
          .from('posts')
          .update({ status: 'scheduled', scheduled_at: when })
          .eq('id', postId);
      }

      navigate(mode === 'draft' ? '/posts' : '/');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>{editId ? 'Edit post' : 'Compose'}</h1>
      <p className="sub">
        {hasAccounts
          ? 'This publishes automatically to the campaign’s connected accounts at the scheduled time.'
          : 'Nothing’s connected for this campaign yet, so it sits on the calendar as a plan until you connect accounts.'}
      </p>

      <label htmlFor="campaign">Campaign</label>
      <select id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <label htmlFor="body">
        Text <span className={chars > 300 ? 'error' : 'muted'}>· {chars} characters</span>
      </label>
      <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
        Limits when it publishes: Bluesky 300 · Threads 500 · Instagram 2,200 · Facebook long
      </p>

      <label htmlFor="images">Images ({totalImages}/{MAX_IMAGES})</label>
      {totalImages < MAX_IMAGES && (
        <input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      )}
      {(existing.length > 0 || files.length > 0) && (
        <div className="thumbs">
          {existing.map((m) => (
            <div className="thumb" key={m.id}>
              <img src={m.url} alt="" />
              <button
                type="button"
                aria-label="Remove image"
                disabled={busy}
                onClick={() => void removeExisting(m)}
              >
                ×
              </button>
            </div>
          ))}
          {files.map((f, i) => (
            <div className="thumb" key={`new-${i}`}>
              <img src={previews[i]} alt={f.name} />
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <label htmlFor="when">Date &amp; time on the calendar</label>
      <input
        id="when"
        type="datetime-local"
        value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
      />

      {error && <p className="notice error">{error}</p>}

      <div className="btnrow">
        <button className="btn secondary" type="button" disabled={busy} onClick={() => void save('draft')}>
          Save as draft
        </button>
        <button
          className="btn"
          type="button"
          disabled={busy || !scheduleAt}
          onClick={() => void save('schedule')}
        >
          {busy ? 'Working…' : editId ? 'Save to calendar' : 'Add to calendar'}
        </button>
        {hasAccounts && (
          <button className="btn secondary" type="button" disabled={busy} onClick={() => void save('now')}>
            Publish now
          </button>
        )}
      </div>
    </>
  );
}
