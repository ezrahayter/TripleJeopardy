import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useAuth } from './lib/useAuth';
import { useWorkspace } from './lib/useWorkspace';
import { AppShell } from './components/AppShell';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { Login } from './pages/Login';
import { Bootstrap } from './pages/Bootstrap';
import { Dashboard } from './pages/Dashboard';

const Calendar = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.Calendar })));
const Posts = lazy(() => import('./pages/Posts').then((m) => ({ default: m.Posts })));
const Approvals = lazy(() => import('./pages/Approvals').then((m) => ({ default: m.Approvals })));
const Requests = lazy(() => import('./pages/Requests').then((m) => ({ default: m.Requests })));
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Compose = lazy(() => import('./pages/Compose').then((m) => ({ default: m.Compose })));
const Accounts = lazy(() => import('./pages/Accounts').then((m) => ({ default: m.Accounts })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Review = lazy(() => import('./pages/Review').then((m) => ({ default: m.Review })));
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })));

function AuthedApp({ user }: { user: User }) {
  const ws = useWorkspace(user.id);
  const [creating, setCreating] = useState(false);

  if (ws.loading) return <CenteredNote>Loading…</CenteredNote>;

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

  if (!ws.org) return <CenteredNote>Loading workspace…</CenteredNote>;
  const orgId = ws.org.id;

  return (
    <AppShell
      workspaces={ws.orgs}
      current={ws.org}
      onSelect={ws.selectWorkspace}
      onNew={() => setCreating(true)}
      email={user.email ?? 'you'}
    >
      <Suspense fallback={<CenteredNote>Loading…</CenteredNote>}>
      <Routes>
        <Route index element={<Dashboard key={orgId} orgId={orgId} />} />
        <Route path="calendar" element={<Calendar key={orgId} orgId={orgId} />} />
        <Route path="posts" element={<Posts key={orgId} orgId={orgId} />} />
        <Route path="approvals" element={<Approvals key={orgId} orgId={orgId} />} />
        <Route path="requests" element={<Requests key={orgId} orgId={orgId} />} />
        <Route path="analytics" element={<Analytics key={orgId} orgId={orgId} />} />
        <Route
          path="compose"
          element={<Compose key={orgId} orgId={orgId} campaigns={ws.campaigns} />}
        />
        <Route
          path="compose/:id"
          element={<Compose orgId={orgId} campaigns={ws.campaigns} />}
        />
        <Route
          path="accounts"
          element={<Accounts key={orgId} orgId={orgId} campaigns={ws.campaigns} />}
        />
        <Route
          path="settings"
          element={
            <Settings
              key={orgId}
              org={ws.org}
              campaigns={ws.campaigns}
              currentUserId={user.id}
              onRename={ws.renameWorkspace}
              onDelete={ws.deleteWorkspace}
              onAddCampaign={ws.addCampaign}
              onRenameCampaign={ws.renameCampaign}
              onDeleteCampaign={ws.deleteCampaign}
              onUpdateApproval={ws.updateCampaignApproval}
              listTeam={ws.listTeam}
              inviteMember={ws.inviteMember}
              removeMember={ws.removeMember}
              cancelInvite={ws.cancelInvite}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AppShell>
  );
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return <CenteredNote>Loading…</CenteredNote>;

  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={200}>
        <Suspense fallback={<CenteredNote>Loading…</CenteredNote>}>
          <Routes>
            <Route path="/review/:token" element={<Review />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route
              path="/*"
              element={session ? <AuthedApp user={session.user} /> : <Login />}
            />
          </Routes>
        </Suspense>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </BrowserRouter>
  );
}
