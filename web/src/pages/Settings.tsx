import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { ApprovalMode, Campaign, Org, PostingSlot } from '@shared/types';
import { FileText } from 'lucide-react';
import { CampaignApproval } from '@/components/CampaignApproval';
import { CampaignDates } from '@/components/CampaignDates';
import { PostingSlots } from '@/components/PostingSlots';
import { TeamSection } from '@/components/TeamSection';
import { ApprovalReport } from '@/components/ApprovalReport';
import type { Invite, Member } from '@/lib/useWorkspace';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Props {
  org: Org;
  campaigns: Campaign[];
  currentUserId: string;
  onRename: (id: string, name: string) => Promise<void>;
  onUpdateOrg: (id: string, patch: { notify_email?: string | null }) => Promise<void>;
  onPauseCampaign: (id: string, paused: boolean) => Promise<void>;
  onUpdateSlots: (id: string, slots: PostingSlot[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddCampaign: (name: string) => Promise<void>;
  onRenameCampaign: (id: string, name: string) => Promise<void>;
  onDeleteCampaign: (id: string) => Promise<void>;
  onUpdateApproval: (
    id: string,
    v: {
      approval_mode: ApprovalMode;
      approver_name: string | null;
      approver_email: string | null;
      waived_networks: string[];
      disclaimer: string | null;
      requests_enabled: boolean;
      review_nudge_hours: number;
    },
  ) => Promise<void>;
  listTeam: (orgId: string) => Promise<{ members: Member[]; invites: Invite[] }>;
  inviteMember: (orgId: string, email: string, role: string) => Promise<void>;
  removeMember: (orgId: string, userId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
}

export function Settings({
  org,
  campaigns,
  currentUserId,
  onRename,
  onUpdateOrg,
  onPauseCampaign,
  onUpdateSlots,
  onDelete,
  onAddCampaign,
  onRenameCampaign,
  onDeleteCampaign,
  onUpdateApproval,
  listTeam,
  inviteMember,
  removeMember,
  cancelInvite,
}: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState(org.name);
  const [notifyEmail, setNotifyEmail] = useState(org.notify_email ?? '');
  const [confirm, setConfirm] = useState('');
  const [newCampaign, setNewCampaign] = useState('');
  const [reportFor, setReportFor] = useState<Campaign | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);

  async function guard(fn: () => Promise<void>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(String((err as Error)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {reportFor && (
        <ApprovalReport
          orgId={org.id}
          campaignId={reportFor.id}
          campaignName={reportFor.name}
          onClose={() => setReportFor(null)}
        />
      )}
      <PageHeader title="Workspace settings" />

      <form
        className="max-w-sm space-y-1.5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (name.trim() && name.trim() !== org.name) {
            void guard(() => onRename(org.id, name), 'Workspace renamed');
          }
        }}
      >
        <Label htmlFor="ws-name">Workspace name</Label>
        <div className="flex gap-2">
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy || !name.trim() || name.trim() === org.name}>
            Save
          </Button>
        </div>
      </form>

      <form
        className="mt-6 max-w-sm space-y-1.5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if ((notifyEmail.trim() || null) !== (org.notify_email ?? null)) {
            void guard(
              () => onUpdateOrg(org.id, { notify_email: notifyEmail }),
              'Notification email saved',
            );
          }
        }}
      >
        <Label htmlFor="ws-notify">Notification email</Label>
        <p className="text-xs text-muted-foreground">
          Where the team is emailed when a candidate submits a post request, approves a post, or
          asks for changes. Leave blank to turn notifications off.
        </p>
        <div className="flex gap-2 pt-1">
          <Input
            id="ws-notify"
            type="email"
            placeholder="ava@example.com"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
          />
          <Button
            type="submit"
            disabled={busy || (notifyEmail.trim() || null) === (org.notify_email ?? null)}
          >
            Save
          </Button>
        </div>
      </form>

      <Separator className="my-8" />

      <TeamSection
        orgId={org.id}
        currentUserId={currentUserId}
        listTeam={listTeam}
        inviteMember={inviteMember}
        removeMember={removeMember}
        cancelInvite={cancelInvite}
      />

      <Separator className="my-8" />

      <h2 className="text-lg font-bold">Campaigns</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Each campaign is a candidate or race, with its own posts and connected accounts.
      </p>

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4">
            {editingId === c.id ? (
              <div className="flex gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  disabled={busy || !editName.trim()}
                  onClick={() =>
                    void guard(async () => {
                      await onRenameCampaign(c.id, editName);
                      setEditingId(null);
                    }, 'Campaign renamed')
                  }
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 font-medium">
                  {c.name}
                  {c.publishing_paused && (
                    <span className="ml-2 rounded bg-destructive px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white">
                      paused
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={c.publishing_paused ? '' : 'text-destructive hover:text-destructive'}
                  disabled={busy}
                  onClick={() =>
                    void guard(
                      () => onPauseCampaign(c.id, !c.publishing_paused),
                      c.publishing_paused ? 'Publishing resumed' : 'Publishing paused',
                    )
                  }
                >
                  {c.publishing_paused ? 'Resume publishing' : 'Pause publishing'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReportFor(c)}>
                  <FileText className="size-4" /> Record
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete "${c.name}" and all its posts, drafts and connected accounts? This cannot be undone.`,
                      )
                    ) {
                      void guard(() => onDeleteCampaign(c.id), 'Campaign deleted');
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            )}
            {editingId !== c.id && (
              <>
                <CampaignApproval campaign={c} onSave={(v) => onUpdateApproval(c.id, v)} />
                <CampaignDates campaignId={c.id} orgId={org.id} />
                <PostingSlots
                  campaignId={c.id}
                  slots={c.posting_slots ?? []}
                  onSave={(slots) => onUpdateSlots(c.id, slots)}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <form
        className="mt-4 max-w-sm space-y-1.5"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (newCampaign.trim()) {
            void guard(async () => {
              await onAddCampaign(newCampaign);
              setNewCampaign('');
            }, 'Campaign added');
          }
        }}
      >
        <Label htmlFor="new-campaign">New campaign</Label>
        <div className="flex gap-2">
          <Input
            id="new-campaign"
            value={newCampaign}
            onChange={(e) => setNewCampaign(e.target.value)}
            placeholder="Rivera for HD 69"
          />
          <Button type="submit" disabled={busy || !newCampaign.trim()}>
            Add
          </Button>
        </div>
      </form>

      <Separator className="my-8" />

      <h2 className="text-lg font-bold text-destructive">Delete this workspace</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted-foreground">
        Permanently removes <strong>{org.name}</strong> and everything in it — every campaign,
        connected account, draft and scheduled post. Published posts stay live on the networks.
      </p>
      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="ws-confirm">
          Type <code className="font-mono text-foreground">{org.name}</code> to confirm
        </Label>
        <Input id="ws-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button
          variant="destructive"
          disabled={busy || confirm !== org.name}
          onClick={() =>
            void guard(async () => {
              await onDelete(org.id);
              navigate('/');
            })
          }
        >
          {busy ? 'Deleting…' : 'Delete workspace'}
        </Button>
      </div>
    </>
  );
}
