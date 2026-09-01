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

export function Accounts({ orgId, campaigns }: { orgId: string; campaigns: Campaign[] }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('social_accounts')
      .select(
        'id, org_id, campaign_id, network, account_type, handle, external_id, service_url, status, token_expires_at, meta, created_at',
      )
      .eq('org_id', orgId)
      .order('created_at');
    setAccounts((data as unknown as SocialAccount[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id);
  }, [campaigns, campaignId]);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      toast.success(
        `Connected ${params.get('connected')} (${params.get('count') ?? '1'} account(s)).`,
      );
    }
    if (params.get('connect_error')) {
      setError(`Connect failed: ${params.get('connect_error')}`);
    }
    if (params.get('connected') || params.get('connect_error')) {
      window.history.replaceState({}, '', '/accounts');
    }
  }, [load]);

  const byCampaign = useMemo(() => {
    return campaigns.map((c) => ({
      campaign: c,
      accounts: accounts.filter((a) => a.campaign_id === c.id),
    }));
  }, [campaigns, accounts]);

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
        description="Connected once per campaign. Whoever connects a Page, everyone in the workspace publishes through it."
      />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

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
                Select this campaign below and connect an account to start publishing for it.
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

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !campaignId} onClick={() => void connectOAuth('meta')}>
          Connect Facebook / Instagram
        </Button>
        <Button
          variant="secondary"
          disabled={busy || !campaignId}
          onClick={() => void connectOAuth('threads')}
        >
          Connect Threads
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Meta connections work for accounts listed as testers on the Meta app until the app clears
        review.
      </p>

      <h2 className="mb-3 mt-8 text-lg font-bold">Connect Bluesky</h2>
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
