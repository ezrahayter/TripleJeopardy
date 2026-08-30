import { useState, type FormEvent } from 'react';

export function Bootstrap({
  onCreate,
}: {
  onCreate: (orgName: string, campaignName: string) => Promise<void>;
}) {
  const [orgName, setOrgName] = useState('Positive Force FL');
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
      <h1>Set up your workspace</h1>
      <p className="sub">One workspace holds every campaign you manage. Add your first race now.</p>
      <form onSubmit={submit}>
        <label htmlFor="org">Workspace name</label>
        <input id="org" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
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
        </div>
      </form>
    </div>
  );
}
