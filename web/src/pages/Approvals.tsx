import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ApprovalMode, ApprovalState, PostStatus } from '@shared/types';
import { PageHeader } from '@/components/PageHeader';
import { Dateline } from '@/components/Dateline';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import { ApprovalChip } from '@/components/StatusChip';
import { ApprovalReport } from '@/components/ApprovalReport';
import { PostRowMenu } from '@/components/PostRowMenu';
import { PostDetailSheet, type DetailPost } from '@/components/PostDetailSheet';
import { Button } from '@/components/ui/button';

const SELECT =
  'id, body, status, approval_state, scheduled_at, campaign:campaigns(id, name, approval_mode, approver_name, waived_networks, review_token)';

interface Row {
  id: string;
  body: string;
  status: PostStatus;
  approval_state: ApprovalState;
  scheduled_at: string | null;
  campaign: {
    id: string;
    name: string;
    approval_mode: ApprovalMode;
    approver_name: string | null;
  } | null;
}

export function Approvals({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('posts')
      .select(SELECT)
      .eq('org_id', orgId)
      .in('approval_state', ['pending', 'changes_requested'])
      .order('scheduled_at', { nullsFirst: false });
    setLoading(false);
    setRows((data as unknown as Row[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const waiting = rows.filter((r) => r.approval_state === 'pending');
  const changes = rows.filter((r) => r.approval_state === 'changes_requested');

  const selected = useMemo<DetailPost | null>(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Posts in the sign-off track — waiting on an approver or back with you for changes."
        action={
          <Button variant="outline" onClick={() => setReport(true)}>
            <FileText className="size-4" /> Export record
          </Button>
        }
      />

      {report && <ApprovalReport orgId={orgId} onClose={() => setReport(false)} />}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing is in review right now.
        </p>
      )}

      {changes.length > 0 && (
        <Section title="Back with you" rows={changes} onOpen={setSelectedId} onChanged={load} />
      )}
      {waiting.length > 0 && (
        <Section
          title="Waiting on the approver"
          rows={waiting}
          onOpen={setSelectedId}
          onChanged={load}
        />
      )}

      <PostDetailSheet
        post={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onReload={load}
        onChanged={() => {
          setSelectedId(null);
          void load();
        }}
      />
    </>
  );
}

function Section({
  title,
  rows,
  onOpen,
  onChanged,
}: {
  title: string;
  rows: Row[];
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  return (
    <div className="mb-6">
      <h2 className="dateline mb-2">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.map((row) => (
          <div
            key={row.id}
            onClick={() => onOpen(row.id)}
            className="flex w-full cursor-pointer items-center gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-background"
          >
            <CampaignAvatar name={row.campaign?.name ?? '—'} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {row.body || <span className="text-muted-foreground">(no text)</span>}
              </span>
              <Dateline campaign={row.campaign?.name} when={row.scheduled_at} />
            </span>
            <ApprovalChip state={row.approval_state} />
            <PostRowMenu postId={row.id} onDone={onChanged} />
          </div>
        ))}
      </div>
    </div>
  );
}
