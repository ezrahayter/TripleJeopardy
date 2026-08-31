import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/useAuth';
import { useWorkspace } from './lib/useWorkspace';
import { Nav } from './components/Nav';
import { Login } from './pages/Login';
import { Bootstrap } from './pages/Bootstrap';
import { Calendar } from './pages/Calendar';
import { Posts } from './pages/Posts';
import { Compose } from './pages/Compose';
import { Accounts } from './pages/Accounts';
import { Settings } from './pages/Settings';

function AuthedApp({ userId }: { userId: string }) {
  const ws = useWorkspace(userId);
  const [creating, setCreating] = useState(false);

  if (ws.loading) return <p className="center muted">Loading…</p>;

  if (ws.orgs.length === 0) {
    return <Bootstrap onCreate={ws.createWorkspace} />;
  }

  if (creating) {
    return (
      <Bootstrap
        onCreate={async (name, campaign) => {
          await ws.createWorkspace(name, campaign);
          setCreating(false);
        }}
        onCancel={() => setCreating(false)}
      />
    );
  }

  if (!ws.org) return <p className="center muted">Loading workspace…</p>;
  const orgId = ws.org.id;

  return (
    <div className="shell">
      <Nav
        workspaces={ws.orgs}
        current={ws.org}
        onSelect={ws.selectWorkspace}
        onNew={() => setCreating(true)}
      />
      <Routes>
        <Route path="/" element={<Calendar key={orgId} orgId={orgId} />} />
        <Route path="/posts" element={<Posts key={orgId} orgId={orgId} />} />
        <Route
          path="/compose"
          element={<Compose key={orgId} orgId={orgId} campaigns={ws.campaigns} />}
        />
        <Route
          path="/accounts"
          element={<Accounts key={orgId} orgId={orgId} campaigns={ws.campaigns} />}
        />
        <Route
          path="/settings"
          element={
            <Settings
              key={orgId}
              org={ws.org}
              onRename={ws.renameWorkspace}
              onDelete={ws.deleteWorkspace}
            />
          }
        />
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
