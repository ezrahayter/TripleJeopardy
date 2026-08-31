import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Campaign } from '@shared/types';

function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Mode = 'draft' | 'schedule' | 'now';

export function Compose({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [scheduleAt, setScheduleAt] = useState(() => isoToLocalInput(params.get('at')));
  const [hasAccounts, setHasAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chars = [...body].length;

  useEffect(() => {
    if (!campaignId) return;
    void supabase
      .from('social_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .then(({ count }) => setHasAccounts((count ?? 0) > 0));
  }, [campaignId]);

  async function save(mode: Mode) {
    setError(null);
    if (!body.trim() && files.length === 0) {
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
      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ org_id: orgId, campaign_id: campaignId, body, status: 'draft' })
        .select('id')
        .single();
      if (postErr || !post) throw postErr ?? new Error('could not create post');

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `${campaignId}/${post.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: mediaErr } = await supabase
          .from('post_media')
          .insert({ post_id: post.id, storage_path: path, sort: i, alt_text: '' });
        if (mediaErr) throw mediaErr;
      }

      if (mode !== 'draft') {
        const when =
          mode === 'schedule' ? new Date(scheduleAt).toISOString() : new Date().toISOString();
        const { error: schedErr } = await supabase
          .from('posts')
          .update({ status: 'scheduled', scheduled_at: when })
          .eq('id', post.id);
        if (schedErr) throw schedErr;
      }

      navigate(mode === 'draft' ? '/posts' : '/');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Compose</h1>
      <p className="sub">
        Write a post and drop it on the calendar.{' '}
        {hasAccounts
          ? 'It publishes automatically to the campaign’s connected accounts at the scheduled time.'
          : 'Nothing’s connected for this campaign yet, so it just sits on the calendar as a plan until you connect accounts.'}
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

      <label htmlFor="images">Images (optional, up to 4)</label>
      <input
        id="images"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
      />

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
          {busy ? 'Working…' : 'Add to calendar'}
        </button>
        {hasAccounts && (
          <button
            className="btn secondary"
            type="button"
            disabled={busy}
            onClick={() => void save('now')}
          >
            Publish now
          </button>
        )}
      </div>
    </>
  );
}
