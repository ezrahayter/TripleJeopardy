import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuth } from './lib/useAuth';
import { useWorkspace } from './lib/useWorkspace';
import { Nav } from './components/Nav';
import { Login } from './pages/Login';
import { SetPassword } from './pages/SetPassword';
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
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <p className="center muted">Loading…</p>;

  return (
    <BrowserRouter>
      {recovery ? (
        <SetPassword onDone={() => setRecovery(false)} />
      ) : session ? (
        <AuthedApp userId={session.user.id} />
      ) : (
        <Login />
      )}
    </BrowserRouter>
  );
}
