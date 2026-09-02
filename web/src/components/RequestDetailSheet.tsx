import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Download, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PostRequestMedia } from '@shared/types';
import type { RequestRow } from '@/pages/Requests';
import { NETWORK_LABEL } from '@/lib/format';
import { Dateline } from '@/components/Dateline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const PHOTO_LABEL: Record<string, string> = {
  have: 'Has photos / video',
  coming_soon: 'Photos / video coming soon',
  none: 'No photos / video',
};

export function RequestDetailSheet({
  request,
  onOpenChange,
  onChanged,
}: {
  request: RequestRow | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const [media, setMedia] = useState<(PostRequestMedia & { url: string })[]>([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [reason, setReason] = useState('');
  const [wantDecline, setWantDecline] = useState(false);
  const [busy, setBusy] = useState(false);

  const key = request?.id ?? 'none';
  const [seenKey, setSeenKey] = useState(key);
  if (key !== seenKey) {
    setSeenKey(key);
    setAssignedTo(request?.assigned_to ?? '');
    setReason(request?.decline_reason ?? '');
    setWantDecline(false);
    setMedia([]);
  }

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    void (async () => {
      const { data: rows } = await supabase
        .from('post_request_media')
        .select('*')
        .eq('request_id', request.id)
        .order('sort');
      const list = (rows as PostRequestMedia[]) ?? [];
      if (!list.length) {
        if (!cancelled) setMedia([]);
        return;
      }
      const { data: signed } = await supabase.storage
        .from('media')
        .createSignedUrls(
          list.map((m) => m.storage_path),
          3600,
        );
      if (cancelled) return;
      setMedia(
        list.map((m, i) => ({ ...m, url: signed?.[i]?.signedUrl ?? '' })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [request]);

  async function downloadOne(m: PostRequestMedia) {
    const name = m.filename || m.storage_path.split('/').pop() || 'download';
    const { data, error } = await supabase.storage
      .from('media')
      .createSignedUrl(m.storage_path, 120, { download: name });
    if (error || !data) {
      toast.error('Could not prepare that download');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadAll() {
    for (const m of media) {
      await downloadOne(m);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (!request) return <Sheet open={false} onOpenChange={onOpenChange} />;

  const isNew = request.status === 'new';

  async function accept() {
    if (!request) return;
    setBusy(true);
    try {
      const parts: string[] = [];
      if (request.caption?.trim()) parts.push(request.caption.trim());
      if (request.exact_wording?.trim())
        parts.push(`— must appear verbatim:\n${request.exact_wording.trim()}`);
      if (request.notes?.trim()) parts.push(`— notes: ${request.notes.trim()}`);

      const scheduledAt = request.planned_publish
        ? new Date(`${request.planned_publish}T12:00:00`).toISOString()
        : null;

      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({
          org_id: request.org_id,
          campaign_id: request.campaign_id,
          status: 'draft',
          approval_state: 'not_required',
          body: parts.join('\n\n'),
          scheduled_at: scheduledAt,
        })
        .select('id')
        .single();
      if (postErr || !post) throw postErr ?? new Error('Could not create the draft.');
      const postId = post.id as string;

      // move the candidate's uploads under the new post
      const { data: mediaRows } = await supabase
        .from('post_request_media')
        .select('*')
        .eq('request_id', request.id)
        .order('sort');
      let sort = 0;
      for (const m of (mediaRows as PostRequestMedia[]) ?? []) {
        const base = m.storage_path.split('/').pop() ?? crypto.randomUUID();
        const dst = `${request.campaign_id}/${postId}/${base}`;
        const { error: cpErr } = await supabase.storage.from('media').copy(m.storage_path, dst);
        if (cpErr) continue;
        await supabase
          .from('post_media')
          .insert({ post_id: postId, storage_path: dst, sort: sort++, alt_text: '' });
      }

      const { error: updErr } = await supabase
        .from('post_requests')
        .update({
          status: 'accepted',
          created_post_id: postId,
          assigned_to: assignedTo.trim() || null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      if (updErr) throw updErr;

      toast.success('Draft created from the request');
      onChanged();
      navigate(`/compose/${postId}`);
    } catch (e) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    if (!request) return;
    setBusy(true);
    const { error } = await supabase
      .from('post_requests')
      .update({
        status: 'declined',
        decline_reason: reason.trim() || null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', request.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Request declined');
    onChanged();
  }

  return (
    <Sheet open={!!request} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
          <Dateline
            campaign={request.campaign?.name}
            when={request.planned_publish ? `${request.planned_publish}T12:00:00` : null}
            fallback="No date given"
            className="mb-1"
          />
          <SheetTitle className="text-base">
            {request.content_type || 'Post request'}
          </SheetTitle>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {request.request_kinds.map((k) => (
              <Badge key={k} variant="outline">
                {k}
              </Badge>
            ))}
          </div>
        </SheetHeader>

        <div className="space-y-4 px-5 py-4 text-sm">
          {request.submitter_email && (
            <Row label="From">{request.submitter_email}</Row>
          )}
          {request.caption?.trim() && (
            <Row label="Caption">
              <p className="whitespace-pre-wrap">{request.caption}</p>
            </Row>
          )}
          {request.exact_wording?.trim() && (
            <Row label="Must appear verbatim">
              <p className="whitespace-pre-wrap">{request.exact_wording}</p>
            </Row>
          )}
          {request.notes?.trim() && (
            <Row label="Notes">
              <p className="whitespace-pre-wrap">{request.notes}</p>
            </Row>
          )}
          {request.reference?.trim() && <Row label="Reference">{request.reference}</Row>}
          {request.platforms.length > 0 && (
            <Row label="Platforms">
              {request.platforms.map((p) => NETWORK_LABEL[p] ?? p).join(', ')}
            </Row>
          )}
          {request.tied_to_event && (
            <Row label="Event">
              {[
                request.event_date,
                request.event_time,
                request.event_location,
              ]
                .filter(Boolean)
                .join(' · ')}
              {request.rsvp_link && request.rsvp_link.toUpperCase() !== 'N/A' && (
                <span className="block text-muted-foreground">RSVP: {request.rsvp_link}</span>
              )}
            </Row>
          )}
          {request.photos_video && (
            <Row label="Media">{PHOTO_LABEL[request.photos_video] ?? request.photos_video}</Row>
          )}
          {request.needs_submitter_approval && (
            <Row label="Approval">
              Wants to approve the draft{request.draft_lead ? ` — ${request.draft_lead}` : ''}
            </Row>
          )}

          {media.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <div className="dateline">Uploads ({media.length})</div>
                {media.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void downloadAll()}
                    className="dateline flex items-center gap-1 text-[color:var(--pf-brick)]"
                  >
                    <Download className="size-3" /> Download all
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {media.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0"
                      title="Open in a new tab"
                    >
                      <img
                        src={m.url}
                        alt=""
                        className="size-14 rounded-md border border-border object-cover"
                      />
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {m.filename || m.storage_path.split('/').pop()}
                      </div>
                      {m.kind === 'resource' && (
                        <div className="dateline mt-0.5">required resource</div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void downloadOne(m)}
                    >
                      <Download className="size-4" /> Download
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3 border-t border-border px-5 py-4">
          {request.status === 'accepted' && request.created_post_id && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => navigate(`/compose/${request.created_post_id}`)}
            >
              Open the draft
            </Button>
          )}

          {isNew && !wantDecline && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="req-assign">Assign to (optional)</Label>
                <Input
                  id="req-assign"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Ava"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="action" disabled={busy} onClick={() => void accept()}>
                  <Check className="size-4" /> Accept &amp; draft
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setWantDecline(true)}>
                  <X className="size-4" /> Decline
                </Button>
              </div>
            </>
          )}

          {isNew && wantDecline && (
            <div className="space-y-2">
              <Textarea
                autoFocus
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you declining? (optional — the candidate doesn't see this yet)"
              />
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void decline()}>
                  Confirm decline
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setWantDecline(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {request.status === 'declined' && (
            <>
              {request.decline_reason && (
                <p className="text-sm italic text-muted-foreground">"{request.decline_reason}"</p>
              )}
              <SheetClose asChild>
                <Button variant="secondary" className="w-full">
                  Close
                </Button>
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="dateline mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}
