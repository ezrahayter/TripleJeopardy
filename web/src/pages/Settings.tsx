import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Org } from '@shared/types';

export function Settings({
  org,
  onRename,
  onDelete,
}: {
  org: Org;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === org.name) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onRename(org.id, name);
      setNotice('Workspace renamed.');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await onDelete(org.id);
      navigate('/');
    } catch (err) {
      setError(String((err as Error)?.message ?? err));
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Workspace settings</h1>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="notice error">{error}</p>}

      <form onSubmit={rename}>
        <label htmlFor="ws-name">Name</label>
        <input
          id="ws-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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

      <h2 style={{ color: 'var(--brick)' }}>Delete this workspace</h2>
      <p className="sub">
        Permanently removes <strong>{org.name}</strong> and everything in it — every campaign,
        connected account, draft and scheduled post. This cannot be undone. Published posts stay
        live on the networks.
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
          onClick={() => void remove()}
        >
          {busy ? 'Deleting…' : 'Delete workspace'}
        </button>
      </div>
    </>
  );
}
