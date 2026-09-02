import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PostRequest, RequestStatus } from '@shared/types';
import { PageHeader } from '@/components/PageHeader';
import { Dateline } from '@/components/Dateline';
import { CampaignAvatar } from '@/components/CampaignAvatar';
import { RequestDetailSheet } from '@/components/RequestDetailSheet';

export interface RequestRow extends PostRequest {
  campaign: { id: string; name: string; timezone: string } | null;
}

const SELECT = '*, campaign:campaigns(id, name, timezone)';

const GROUPS: { key: RequestStatus; title: string }[] = [
  { key: 'new', title: 'New' },
  { key: 'accepted', title: 'Accepted' },
  { key: 'declined', title: 'Declined' },
];

export function Requests({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('post_requests')
      .select(SELECT)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    setLoading(false);
    setRows((data as unknown as RequestRow[]) ?? []);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <>
      <PageHeader
        title="Requests"
        description="Post ideas the candidate sent from their portal link. Accept one to spin up a draft, or send it back."
      />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          <Inbox className="mx-auto mb-2 size-5 opacity-60" />
          No requests yet. They'll land here when a candidate submits one.
        </p>
      )}

      {GROUPS.map(({ key, title }) => {
        const group = rows.filter((r) => r.status === key);
        if (!group.length) return null;
        return (
          <div key={key} className="mb-6">
            <h2 className="dateline mb-2">
              {title} ({group.length})
            </h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {group.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="flex w-full items-center gap-3 border-b border-border p-4 text-left last:border-b-0 hover:bg-background"
                >
                  <CampaignAvatar name={row.campaign?.name ?? '—'} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {summary(row) || <span className="text-muted-foreground">(no detail)</span>}
                    </span>
                    <Dateline
                      campaign={row.campaign?.name}
                      when={row.planned_publish ? `${row.planned_publish}T12:00:00` : null}
                      fallback="No date given"
                    />
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 sm:flex">
                    {triageFlags(row).map((f) => (
                      <span
                        key={f}
                        className="rounded-full border border-[color:var(--pf-brick)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] text-[color:var(--pf-brick)]"
                      >
                        {f}
                      </span>
                    ))}
                    {row.content_type && (
                      <span className="rounded font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                        {row.content_type}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <RequestDetailSheet
        request={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={() => {
          setSelectedId(null);
          void load();
        }}
      />
    </>
  );
}

function triageFlags(r: RequestRow): string[] {
  if (r.status !== 'new') return [];
  const flags: string[] = [];
  if (r.planned_publish) {
    const days = (new Date(`${r.planned_publish}T12:00:00`).getTime() - Date.now()) / 864e5;
    if (days <= 7) flags.push('Short notice');
  }
  if (r.photos_video === 'coming_soon') flags.push('Media pending');
  if (r.needs_submitter_approval) flags.push('Wants approval');
  return flags;
}

function summary(r: RequestRow): string {
  const text = r.caption?.trim() || r.exact_wording?.trim() || r.notes?.trim() || '';
  const line = text.split('\n')[0] ?? '';
  return line.length > 80 ? line.slice(0, 80) + '…' : line;
}
