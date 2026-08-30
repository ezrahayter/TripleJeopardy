import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export function Nav() {
  const { signOut } = useAuth();
  return (
    <header className="topbar">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force FL</span>
      </span>
      <nav className="nav">
        <NavLink to="/" end>
          Posts
        </NavLink>
        <NavLink to="/compose">Compose</NavLink>
        <NavLink to="/accounts">Accounts</NavLink>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </nav>
    </header>
  );
}
