import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApprovalMode, Campaign, Org } from '@shared/types';
import { CampaignApproval } from '../components/CampaignApproval';

interface Props {
  org: Org;
  campaigns: Campaign[];
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddCampaign: (name: string) => Promise<void>;
  onRenameCampaign: (id: string, name: string) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onUpdateApproval: (
    id: string,
    v: { approval_mode: ApprovalMode; approver_name: string | null; approver_email: string | null },
  ) => Promise<void>;
}

export function Settings({
  org,
  campaigns,
  onRename,
  onDelete,
  onAddCampaign,
  onRenameCampaign,
  onDeleteCampaign,
  onUpdateApproval,
}: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [confirm, setConfirm] = useState('');
  const [newCampaign, setNewCampaign] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function guard(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Workspace settings</h1>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="notice error">{error}</p>}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== org.name) {
            void guard(() => onRename(org.id, name), 'Workspace renamed.');
          }
        }}
      >
        <label htmlFor="ws-name">Workspace name</label>
        <input id="ws-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="btnrow">
          <button
            className="btn"
            type="submit"
            disabled={busy || !name.trim() || name.trim() === org.name}
          >
            Save name
          </button>
        </div>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--rule)', margin: '32px 0' }} />

      <h2>Campaigns</h2>
      <p className="sub">Each campaign is a candidate or race, with its own posts and accounts.</p>

      {campaigns.map((c) => (
        <div className="card" key={c.id}>
          {editingId === c.id ? (
            <div className="btnrow" style={{ marginTop: 0 }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn"
                type="button"
                disabled={busy || !editName.trim()}
                onClick={() =>
                  void guard(async () => {
                    await onRenameCampaign(c.id, editName);
                    setEditingId(null);
                  })
                }
              >
                Save
              </button>
              <button className="btn secondary" type="button" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <div
              style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <strong style={{ flex: 1 }}>{c.name}</strong>
              <button
                className="btn secondary"
                type="button"
                onClick={() => {
                  setEditingId(c.id);
                  setEditName(c.name);
                }}
              >
                Rename
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${c.name}" and all its posts, drafts and connected accounts? This cannot be undone.`,
                    )
                  ) {
                    void guard(() => onDeleteCampaign(c.id));
                  }
                }}
              >
                Delete
              </button>
            </div>
          )}
          {editingId !== c.id && (
            <CampaignApproval campaign={c} onSave={(v) => onUpdateApproval(c.id, v)} />
          )}
        </div>
      ))}

      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (newCampaign.trim()) {
            void guard(async () => {
              await onAddCampaign(newCampaign);
              setNewCampaign('');
            }, 'Campaign added.');
          }
        }}
      >
        <label htmlFor="new-campaign">New campaign</label>
        <input
          id="new-campaign"
          type="text"
          value={newCampaign}
          onChange={(e) => setNewCampaign(e.target.value)}
          placeholder="Rivera for HD 69"
        />
        <div className="btnrow">
          <button className="btn" type="submit" disabled={busy || !newCampaign.trim()}>
            Add campaign
          </button>
        </div>
      </form>

      <hr style={{ border: 'none', borderTop: '1px solid var(--rule)', margin: '32px 0' }} />

      <h2 style={{ color: 'var(--brick)' }}>Delete this workspace</h2>
      <p className="sub">
        Permanently removes <strong>{org.name}</strong> and everything in it — every campaign,
        connected account, draft and scheduled post. Cannot be undone. Published posts stay live on
        the networks.
      </p>
      <label htmlFor="ws-confirm">
        Type <code>{org.name}</code> to confirm
      </label>
      <input
        id="ws-confirm"
        type="text"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div className="btnrow">
        <button
          className="btn danger"
          type="button"
          disabled={busy || confirm !== org.name}
          onClick={() =>
            void guard(async () => {
              await onDelete(org.id);
              navigate('/');
            })
          }
        >
          {busy ? 'Deleting…' : 'Delete workspace'}
        </button>
      </div>
    </>
  );
}
