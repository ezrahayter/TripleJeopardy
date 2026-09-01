import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Invite, Member } from '../lib/useWorkspace';

interface Props {
  orgId: string;
  currentUserId: string;
  listTeam: (orgId: string) => Promise<{ members: Member[]; invites: Invite[] }>;
  inviteMember: (orgId: string, email: string, role: string) => Promise<void>;
  removeMember: (orgId: string, userId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
}

export function TeamSection({
  orgId,
  currentUserId,
  listTeam,
  inviteMember,
  removeMember,
  cancelInvite,
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const t = await listTeam(orgId);
      setMembers(t.members);
      setInvites(t.invites);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    }
  }, [orgId, listTeam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function guard(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await refresh();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  function submitInvite(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!addr) return;
    void guard(async () => {
      await inviteMember(orgId, addr, role);
      setEmail('');
    }, `${addr} added. If they don't have an account yet, they'll join the first time they sign in with that email.`);
  }

  return (
    <>
      <h2>Team</h2>
      <p className="sub">
        People here can draft, schedule and manage posts for every campaign in this workspace.
        Connected social accounts are shared — whoever connects a Page, everyone publishes through it.
      </p>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="notice error">{error}</p>}

      {members.map((m) => (
        <div className="card" key={m.user_id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>
              {m.email}
              {m.user_id === currentUserId && <span className="muted"> (you)</span>}
            </span>
            <span className="appr-chip">{m.role}</span>
            {m.user_id !== currentUserId && (
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${m.email} from this workspace?`)) {
                    void guard(() => removeMember(orgId, m.user_id));
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}

      {invites.map((inv) => (
        <div className="card" key={inv.id}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>
              {inv.email} <span className="muted">— invited, not signed in yet</span>
            </span>
            <span className="appr-chip">{inv.role}</span>
            <button
              className="btn secondary"
              type="button"
              disabled={busy}
              onClick={() => void guard(() => cancelInvite(inv.id))}
            >
              Cancel
            </button>
          </div>
        </div>
      ))}

      <form onSubmit={submitInvite}>
        <label htmlFor="invite-email">Invite by email</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ava@positiveforce.win"
        />
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="editor">Editor — full access</option>
          <option value="viewer">Viewer — read only</option>
          <option value="owner">Owner — full access + manage team &amp; workspace</option>
        </select>
        <div className="btnrow">
          <button className="btn" type="submit" disabled={busy || !email.trim()}>
            Send invite
          </button>
        </div>
      </form>
    </>
  );
}
