import { NavLink } from 'react-router-dom';
import type { Org } from '@shared/types';
import { useAuth } from '../lib/useAuth';

const NEW = '__new';

export function Nav({
  workspaces,
  current,
  onSelect,
  onNew,
}: {
  workspaces: Org[];
  current: Org;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { signOut } = useAuth();

  return (
    <header className="topbar">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force</span>
      </span>

      <select
        className="ws-select"
        value={current.id}
        onChange={(e) => (e.target.value === NEW ? onNew() : onSelect(e.target.value))}
        aria-label="Workspace"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
        <option value={NEW}>+ New workspace…</option>
      </select>

      <nav className="nav">
        <NavLink to="/" end>
          Calendar
        </NavLink>
        <NavLink to="/posts">Posts</NavLink>
        <NavLink to="/compose">Compose</NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
    </header>
  );
}
