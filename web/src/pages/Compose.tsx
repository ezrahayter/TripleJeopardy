import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { blueskyAdapter } from '@shared/adapters';
import type { Campaign } from '@shared/types';

const BLUESKY_LIMIT = 300;

export function Compose({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const navigate = useNavigate();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [scheduleAt, setScheduleAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const over = [...body].length > BLUESKY_LIMIT;

  async function save(schedule: boolean) {
    setError(null);

    const check = blueskyAdapter.validate({
      body,
      media: files.map((f) => ({ bytes: new Uint8Array(), mime: f.type })),
    });
    // ignore the "empty bytes" size check here - real bytes are validated at publish
    const realErrors = check.errors.filter((e) => !e.includes('under 1 MB'));
    if (realErrors.length) {
      setError(realErrors.join(' '));
      return;
    }
    if (!campaignId) {
      setError('Pick a campaign.');
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
        const { error: upErr } = await supabase.storage.from('media').upload(path, file, {
          contentType: file.type,
        });
        if (upErr) throw upErr;
        const { error: mediaErr } = await supabase
          .from('post_media')
          .insert({ post_id: post.id, storage_path: path, sort: i, alt_text: '' });
        if (mediaErr) throw mediaErr;
      }

      if (schedule) {
        const when = scheduleAt ? new Date(scheduleAt).toISOString() : new Date().toISOString();
        const { error: schedErr } = await supabase
          .from('posts')
          .update({ status: 'scheduled', scheduled_at: when })
          .eq('id', post.id);
        if (schedErr) throw schedErr;
      }

      navigate('/');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Compose</h1>
      <p className="sub">
        Phase 0: one text + image post, published to every connected Bluesky account on the campaign.
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
        Text{' '}
        <span className={over ? 'error' : 'muted'}>
          {[...body].length}/{BLUESKY_LIMIT}
        </span>
      </label>
      <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />

      <label htmlFor="images">Images (optional, up to 4, under 1 MB each)</label>
      <input
        id="images"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
      />

      <label htmlFor="when">Schedule for (optional - blank = now)</label>
      <input
        id="when"
        type="datetime-local"
        value={scheduleAt}
        onChange={(e) => setScheduleAt(e.target.value)}
      />

      {error && <p className="notice error">{error}</p>}

      <div className="btnrow">
        <button className="btn secondary" type="button" disabled={busy} onClick={() => void save(false)}>
          Save draft
        </button>
        <button className="btn" type="button" disabled={busy} onClick={() => void save(true)}>
          {busy ? 'Working…' : scheduleAt ? 'Schedule' : 'Publish now'}
        </button>
      </div>
    </>
  );
}
