import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Campaign, SocialAccount } from '@shared/types';

export function Accounts({ campaigns }: { campaigns: Campaign[] }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('social_accounts')
      .select('id, org_id, campaign_id, network, account_type, handle, external_id, service_url, status, created_at')
      .order('created_at');
    setAccounts((data as unknown as SocialAccount[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function connect(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.functions.invoke('connect-bluesky', {
      body: { campaign_id: campaignId, handle, app_password: appPassword },
    });
    setBusy(false);
    if (error) {
      let message = error.message;
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) message = body.error as string;
      } catch {
        /* fall back to the generic message */
      }
      setError(message);
      return;
    }
    setHandle('');
    setAppPassword('');
    void load();
  }

  async function remove(id: string) {
    await supabase.from('social_accounts').delete().eq('id', id);
    void load();
  }

  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <h1>Accounts</h1>
      <p className="sub">
        Connect a Bluesky account with an{' '}
        <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer">
          app password
        </a>{' '}
        — not the account's real password.
      </p>

      {accounts.map((a) => (
        <div className="card" key={a.id}>
          <strong>@{a.handle}</strong> <span className="muted">· {a.network} · {a.status}</span>
          <div className="meta">
            {campaignName(a.campaign_id)} · {a.external_id ?? 'no DID'}
          </div>
          <div className="btnrow">
            <button className="btn danger" type="button" onClick={() => void remove(a.id)}>
              Disconnect
            </button>
          </div>
        </div>
      ))}

      <h2>Connect Bluesky</h2>
      <form onSubmit={connect}>
        <label htmlFor="c">Campaign</label>
        <select id="c" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label htmlFor="h">Handle</label>
        <input
          id="h"
          type="text"
          required
          placeholder="name.bsky.social"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />

        <label htmlFor="p">App password</label>
        <input
          id="p"
          type="password"
          required
          placeholder="xxxx-xxxx-xxxx-xxxx"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
        />

        {error && <p className="notice error">{error}</p>}
        <div className="btnrow">
          <button className="btn" type="submit" disabled={busy || !campaignId}>
            {busy ? 'Verifying…' : 'Connect'}
          </button>
        </div>
      </form>
    </>
  );
}
