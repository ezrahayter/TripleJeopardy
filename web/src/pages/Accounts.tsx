import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Campaign, SocialAccount } from '@shared/types';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { timeAgo } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUS_DOT: Record<string, string> = {
  active: 'bg-[color:var(--pf-olive)]',
  error: 'bg-destructive',
  revoked: 'bg-muted-foreground',
};

const SKIP = '__skip__';

interface StagedAsset {
  network: string;
  external_id: string;
  handle: string;
  meta: Record<string, unknown>;
}
interface PendingConnection {
  id: string;
  provider: string;
  assets: StagedAsset[];
}

export function Accounts({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('social_accounts')
      .select(
        'id, org_id, campaign_id, network, account_type, handle, external_id, service_url, status, token_error, token_expires_at, meta, created_at',
      )
      .eq('org_id', orgId)
      .order('created_at');
    setAccounts((data as unknown as SocialAccount[]) ?? []);
  }, [orgId]);

  const loadPending = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('pending_connections')
      .select('id, provider, assets')
      .eq('id', id)
      .maybeSingle();
    if (data) {
      setPending(data as unknown as PendingConnection);
      setAssign({});
    } else {
      setError('That connection has expired — reconnect.');
    }
  }, []);

  useEffect(() => {
    if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('assign')) {
      void loadPending(params.get('assign')!);
    }
    if (params.get('connect_error')) {
      setError(`Connect failed: ${params.get('connect_error')}`);
    }
    if (params.get('connected')) {
      toast.success(`Connected ${params.get('connected')}.`);
    }
    if (params.get('connected') || params.get('connect_error') || params.get('assign')) {
      window.history.replaceState({}, '', '/accounts');
    }
  }, [load, loadPending]);

  const byCampaign = useMemo(() => {
    return campaigns.map((c) => ({
      campaign: c,
      accounts: accounts.filter((a) => a.campaign_id === c.id),
    }));
  }, [campaigns, accounts]);

  // pick a campaign for one asset; a Facebook Page carries its linked Instagram along
  function setAssignment(asset: StagedAsset, value: string) {
    setAssign((prev) => {
      const next = { ...prev, [asset.external_id]: value };
      if (asset.network === 'facebook') {
        for (const a of pending?.assets ?? []) {
          if (a.network === 'instagram' && a.meta?.page_id === asset.external_id && !prev[a.external_id]) {
            next[a.external_id] = value;
          }
        }
      }
      return next;
    });
  }

  async function confirmAssign() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const assignments = pending.assets.map((a) => ({
      external_id: a.external_id,
      campaign_id: assign[a.external_id] && assign[a.external_id] !== SKIP ? assign[a.external_id] : null,
    }));
    const { data, error } = await supabase.functions.invoke('connect-assign', {
      body: { pending_id: pending.id, assignments },
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? 'Could not finish connecting.');
      return;
    }
    const n = (data as { connected?: number } | null)?.connected ?? 0;
    toast.success(n ? `Connected ${n} account${n > 1 ? 's' : ''}.` : 'Nothing connected.');
    setPending(null);
    await load();
  }

  async function cancelAssign() {
    if (pending) await supabase.from('pending_connections').delete().eq('id', pending.id);
    setPending(null);
  }

  async function connectOAuth(provider: 'meta' | 'threads') {
    setError(null);
    if (provider === 'threads' && !campaignId) {
      setError('Pick a campaign first.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('oauth-start', {
      body: {
        provider,
        ...(provider === 'threads' ? { campaign_id: campaignId } : { org_id: orgId }),
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
    try {
      const { data, error } = await supabase.functions.invoke('connect-bluesky', {
        body: { campaign_id: campaignId, handle: handle.trim(), app_password: appPassword.trim() },
      });
      if (error) {
        let message = error.message;
        try {
          const b = await (error as { context?: Response }).context?.json();
          if (b?.error) message = b.error as string;
        } catch {
          /* keep generic */
        }
        setError(`Bluesky connect failed: ${message}`);
        return;
      }
      const acct = (data as { account?: { handle?: string } } | null)?.account;
      toast.success(`Connected @${acct?.handle ?? handle.trim()}`);
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
    toast.success('Disconnected');
    void load();
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Connected per campaign. Whoever connects a Page, everyone in the workspace publishes through it."
      />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {pending && (
        <div className="mb-6 rounded-xl border border-primary/40 bg-card p-5">
          <h2 className="text-lg font-bold">Assign the Pages you just connected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You granted access to {pending.assets.length} account
            {pending.assets.length > 1 ? 's' : ''}. Pick the campaign each belongs to, or leave it
            as “Don’t connect.” An Instagram account follows its Facebook Page by default.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {pending.assets.map((a) => {
              const nm = NETWORKS[a.network as NetworkId];
              const Icon = nm?.icon;
              return (
                <li key={a.external_id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
                    {Icon ? <Icon className="size-4" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.handle}</div>
                    <div className="dateline mt-0.5">{nm?.label ?? a.network}</div>
                  </div>
                  <Select
                    value={assign[a.external_id] ?? SKIP}
                    onValueChange={(v) => setAssignment(a, v)}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP}>Don’t connect</SelectItem>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button disabled={busy} onClick={() => void confirmAssign()}>
              {busy ? 'Connecting…' : 'Connect selected'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void cancelAssign()}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {byCampaign.map(({ campaign, accounts: accts }) => (
          <div key={campaign.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <CampaignAvatar name={campaign.name} size={30} />
              <span className="font-semibold">{campaign.name}</span>
              <span className="dateline ml-auto">
                {accts.length === 0
                  ? 'nothing connected'
                  : `${accts.length} account${accts.length > 1 ? 's' : ''}`}
              </span>
            </div>

            {accts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Connect an account below, then assign it here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {accts.map((a) => {
                  const meta = NETWORKS[a.network as NetworkId];
                  const Icon = meta?.icon;
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                      <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
                        {Icon ? <Icon className="size-4" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <span
                            className={cn('size-1.5 rounded-full', STATUS_DOT[a.status] ?? 'bg-muted-foreground')}
                          />
                          @{a.handle}
                        </div>
                        <div className="dateline mt-0.5">
                          {meta?.label ?? a.network} · {a.status}
                          {a.token_expires_at && ` · token ${timeAgo(a.token_expires_at)}`}
                        </div>
                        {a.status === 'error' && a.token_error && (
                          <div className="mt-0.5 text-xs text-destructive">
                            {a.token_error} — reconnect to fix.
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void remove(a.id)}
                      >
                        Disconnect
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Connect an account</h2>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void connectOAuth('meta')}>
          Connect Facebook / Instagram
        </Button>
        <Button variant="secondary" disabled={busy || !campaignId} onClick={() => void connectOAuth('threads')}>
          Connect Threads
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Facebook / Instagram: authorize once, then assign each Page to a campaign. Until the Meta
        app clears review, only accounts with a role on the app can connect.
      </p>

      <h2 className="mb-3 mt-8 text-lg font-bold">Connect Bluesky</h2>
      <div className="mb-4 max-w-xs space-y-1.5">
        <Label htmlFor="c">Campaign</Label>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger id="c" className="w-full">
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
      <form onSubmit={connectBluesky} className="max-w-sm space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="h">Handle</Label>
          <Input
            id="h"
            required
            placeholder="name.bsky.social"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p">
            App password{' '}
            <a
              className="text-[color:var(--pf-brick)] underline underline-offset-2"
              href="https://bsky.app/settings/app-passwords"
              target="_blank"
              rel="noreferrer"
            >
              (create one)
            </a>
          </Label>
          <Input
            id="p"
            type="password"
            required
            placeholder="xxxx-xxxx-xxxx-xxxx"
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy || !campaignId}>
          {busy ? 'Verifying…' : 'Connect Bluesky'}
        </Button>
      </form>
    </>
  );
}
