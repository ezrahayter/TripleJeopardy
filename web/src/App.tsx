import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { useWorkspace } from './lib/useWorkspace';
import { Nav } from './components/Nav';
import { Login } from './pages/Login';
import { Bootstrap } from './pages/Bootstrap';
import { Posts } from './pages/Posts';
import { Compose } from './pages/Compose';
import { Accounts } from './pages/Accounts';

function AuthedApp({ userId }: { userId: string }) {
  const { loading, org, campaigns, bootstrap } = useWorkspace(userId);

  if (loading) return <p className="center muted">Loading workspace…</p>;
  if (!org) return <Bootstrap onCreate={bootstrap} />;

  return (
    <div className="shell">
      <Nav />
      <Routes>
        <Route path="/" element={<Posts />} />
        <Route path="/compose" element={<Compose orgId={org.id} campaigns={campaigns} />} />
        <Route path="/accounts" element={<Accounts campaigns={campaigns} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <p className="center muted">Loading…</p>;

  return (
    <BrowserRouter>
      {session ? <AuthedApp userId={session.user.id} /> : <Login />}
    </BrowserRouter>
  );
}
