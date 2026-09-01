import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Bootstrap({
  onCreate,
  onCancel,
}: {
  onCreate: (orgName: string, campaignName: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [orgName, setOrgName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onCreate(orgName, campaignName);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black tracking-tight">
          {onCancel ? 'New workspace' : 'Set up your workspace'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A workspace is a self-contained set of campaigns and connected accounts.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org">Workspace name</Label>
            <Input
              id="org"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Weston Media"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign">First campaign</Label>
            <Input
              id="campaign"
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Rivera for HD 69"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create workspace'}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
