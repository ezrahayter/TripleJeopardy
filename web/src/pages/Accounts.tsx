import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Campaign, SocialAccount } from '@shared/types';

const NETWORK_LABEL: Record<string, string> = {
  bluesky: 'Bluesky',
  facebook: 'Facebook Page',
  instagram: 'Instagram',
  threads: 'Threads',
};

export function Accounts({ campaigns }: { campaigns: Campaign[] }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('social_accounts')
      .select(
        'id, org_id, campaign_id, network, account_type, handle, external_id, service_url, status, token_expires_at, meta, created_at',
      )
      .order('created_at');
    setAccounts((data as unknown as SocialAccount[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      setNotice(`Connected ${params.get('connected')} (${params.get('count') ?? '1'} account(s)).`);
    }
    if (params.get('connect_error')) {
      setError(`Connect failed: ${params.get('connect_error')}`);
    }
    if (params.get('connected') || params.get('connect_error')) {
      window.history.replaceState({}, '', '/accounts');
    }
  }, [load]);

  async function connectOAuth(provider: 'meta' | 'threads') {
    setError(null);
    if (!campaignId) {
      setError('Pick a campaign first.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('oauth-start', {
      body: {
        campaign_id: campaignId,
        provider,
        redirect_to: `${window.location.origin}/accounts`,
      },
    });
    setBusy(false);
    if (error || !data?.url) {
      setError(error?.message ?? 'Could not start the connect flow.');
      return;
    }
    window.location.href = data.url as string;
  }

  async function connectBluesky(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('connect-bluesky', {
        body: { campaign_id: campaignId, handle: handle.trim(), app_password: appPassword.trim() },
      });
      if (error) {
        let message = error.message;
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) message = body.error as string;
        } catch {
          /* keep the generic message */
        }
        setError(`Bluesky connect failed: ${message}`);
        return;
      }
      const acct = (data as { account?: { handle?: string } } | null)?.account;
      setNotice(`Connected Bluesky account @${acct?.handle ?? handle.trim()}.`);
      setHandle('');
      setAppPassword('');
      await load();
    } catch (err) {
      setError(`Bluesky connect failed: ${String((err as Error)?.message ?? err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await supabase.from('social_accounts').delete().eq('id', id);
    void load();
  }

  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <h1>Accounts</h1>
      <p className="sub">Connect the accounts this campaign posts from.</p>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="notice error">{error}</p>}

      <label htmlFor="c">Campaign</label>
      <select id="c" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {accounts.map((a) => (
        <div className="card" key={a.id}>
          <strong>@{a.handle}</strong>{' '}
          <span className="muted">
            · {NETWORK_LABEL[a.network] ?? a.network} · {a.status}
          </span>
          <div className="meta">
            {campaignName(a.campaign_id)}
            {a.token_expires_at && ` · token expires ${new Date(a.token_expires_at).toLocaleDateString()}`}
          </div>
          <div className="btnrow">
            <button className="btn danger" type="button" onClick={() => void remove(a.id)}>
              Disconnect
            </button>
          </div>
        </div>
      ))}

      <h2>Connect an account</h2>

      <div className="btnrow">
        <button
          className="btn"
          type="button"
          disabled={busy || !campaignId}
          onClick={() => void connectOAuth('meta')}
        >
          Connect Facebook / Instagram
        </button>
        <button
          className="btn"
          type="button"
          disabled={busy || !campaignId}
          onClick={() => void connectOAuth('threads')}
        >
          Connect Threads
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
        Meta connections need the app approved for Advanced Access first — until then
        the authorize screen only works for accounts listed as testers on the Meta app.
      </p>

      <h2>Connect Bluesky</h2>
      <form onSubmit={connectBluesky}>
        <label htmlFor="h">Handle</label>
        <input
          id="h"
          type="text"
          required
          placeholder="name.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <label htmlFor="p">
          App password (
          <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">
            create one
          </a>
          )
        </label>
        <input
          id="p"
          type="password"
          required
          placeholder="xxxx-xxxx-xxxx-xxxx"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
        />
        <div className="btnrow">
          <button className="btn secondary" type="submit" disabled={busy || !campaignId}>
            {busy ? 'Verifying…' : 'Connect Bluesky'}
          </button>
        </div>
      </form>
    </>
  );
}
