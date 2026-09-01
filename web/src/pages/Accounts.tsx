import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Campaign, SocialAccount } from '@shared/types';
import { NETWORK_LABEL } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
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

  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Connected once per campaign. Whoever connects a Page, everyone in the workspace publishes through it."
      />

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6 max-w-xs space-y-1.5">
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

      {accounts.length > 0 && (
        <div className="mb-8 overflow-hidden rounded-lg border border-border bg-card">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border p-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">@{a.handle}</div>
                <div className="dateline mt-0.5">
                  {NETWORK_LABEL[a.network] ?? a.network} · {campaignName(a.campaign_id)} · {a.status}
                  {a.token_expires_at &&
                    ` · token to ${new Date(a.token_expires_at).toLocaleDateString()}`}
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
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-lg font-bold">Connect an account</h2>

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
