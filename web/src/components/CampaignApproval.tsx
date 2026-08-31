import { useState } from 'react';
import type { ApprovalMode, Campaign } from '@shared/types';

const MODE_LABEL: Record<ApprovalMode, string> = {
  candidate: 'Candidate approves every post',
  designated: 'A designated person approves',
  waived: 'Approval waived — posts publish without sign-off',
};

export function CampaignApproval({
  campaign,
  onSave,
}: {
  campaign: Campaign;
  onSave: (v: {
    approval_mode: ApprovalMode;
    approver_name: string | null;
    approver_email: string | null;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ApprovalMode>(campaign.approval_mode);
  const [name, setName] = useState(campaign.approver_name ?? '');
  const [email, setEmail] = useState(campaign.approver_email ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const summary =
    campaign.approval_mode === 'waived'
      ? 'Approval waived'
      : `${campaign.approval_mode === 'candidate' ? 'Candidate approves' : 'Designated approver'}${
          campaign.approver_name ? ` · ${campaign.approver_name}` : ''
        }`;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        approval_mode: mode,
        approver_name: mode === 'waived' ? null : name,
        approver_email: mode === 'waived' ? null : email,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      setOpen(false);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="draft-toggle"
        style={{ fontSize: '0.8rem', color: 'var(--olive)' }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? '▾' : '▸'} Approval: {summary}
        {saved && ' ✓'}
      </button>

      {open && (
        <div style={{ marginTop: 8 }}>
          <label htmlFor={`mode-${campaign.id}`}>How posts get approved</label>
          <select
            id={`mode-${campaign.id}`}
            value={mode}
            onChange={(e) => setMode(e.target.value as ApprovalMode)}
          >
            {(Object.keys(MODE_LABEL) as ApprovalMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>

          {mode !== 'waived' && (
            <>
              <label htmlFor={`an-${campaign.id}`}>
                {mode === 'candidate' ? "Candidate's name" : "Approver's name"}
              </label>
              <input
                id={`an-${campaign.id}`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ava Rivera"
              />
              <label htmlFor={`ae-${campaign.id}`}>Their email (for your reference)</label>
              <input
                id={`ae-${campaign.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          )}

          {err && <p className="notice error">{err}</p>}
          <div className="btnrow">
            <button className="btn" type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save approval settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
