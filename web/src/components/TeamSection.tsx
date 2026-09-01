import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Invite, Member } from '@/lib/useWorkspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

  const refresh = useCallback(async () => {
    try {
      const t = await listTeam(orgId);
      setMembers(t.members);
      setInvites(t.invites);
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
    }
  }, [orgId, listTeam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function guard(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
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
    }, `${addr} added. If they have no account yet, they join on first sign-in with that email.`);
  }

  return (
    <>
      <h2 className="text-lg font-bold">Team</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted-foreground">
        Everyone here can draft, schedule, and manage posts for every campaign. Connected accounts
        are shared — whoever connects a Page, the whole team publishes through it.
      </p>

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.user_id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3.5"
          >
            <span className="flex-1 text-sm">
              {m.email}
              {m.user_id === currentUserId && (
                <span className="text-muted-foreground"> (you)</span>
              )}
            </span>
            <span className="dateline">{m.role}</span>
            {m.user_id !== currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Remove ${m.email} from this workspace?`)) {
                    void guard(() => removeMember(orgId, m.user_id), 'Removed');
                  }
                }}
              >
                Remove
              </Button>
            )}
          </div>
        ))}

        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-card p-3.5"
          >
            <span className="flex-1 text-sm">
              {inv.email}{' '}
              <span className="text-muted-foreground">— invited, not signed in yet</span>
            </span>
            <span className="dateline">{inv.role}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void guard(() => cancelInvite(inv.id), 'Invite cancelled')}
            >
              Cancel
            </Button>
          </div>
        ))}
      </div>

      <form onSubmit={submitInvite} className="mt-4 max-w-sm space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ava@positiveforce.win"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor — full access</SelectItem>
              <SelectItem value="viewer">Viewer — read only</SelectItem>
              <SelectItem value="owner">Owner — full access + manage team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy || !email.trim()}>
          Send invite
        </Button>
      </form>
    </>
  );
}
