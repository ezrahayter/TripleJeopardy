import { useState, type FormEvent } from 'react';

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
    <div className="center">
      <h1>{onCancel ? 'New workspace' : 'Set up your workspace'}</h1>
      <p className="sub">
        A workspace is a self-contained set of campaigns and connected accounts.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="org">Workspace name</label>
        <input
          id="org"
          type="text"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          placeholder="Positive Force"
        />
        <label htmlFor="campaign">First campaign</label>
        <input
          id="campaign"
          type="text"
          required
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Morales for Senate"
        />
        {error && <p className="notice error">{error}</p>}
        <div className="btnrow">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create workspace'}
          </button>
          {onCancel && (
            <button className="btn secondary" type="button" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
