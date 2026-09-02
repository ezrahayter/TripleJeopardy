import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { MediaDropzone, type MediaItem } from '@/components/compose/MediaDropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const REQUEST_KINDS = [
  'Event promotion',
  'Endorsement announcement',
  'Fundraising push',
  'Volunteer recruitment',
  'Issue or rapid response',
  'Press hit or news coverage',
  'Community spotlight',
  'Other',
];

const CONTENT_TYPES = [
  'Reel / short-form video (10–30s)',
  'Long-form video (30–80s)',
  'Static graphic',
  'Carousel (2–5 graphics)',
  'Other',
];

const PHOTO_OPTS = [
  { v: 'have', l: 'Yes — I have them' },
  { v: 'coming_soon', l: 'Coming soon' },
  { v: 'none', l: 'No' },
] as const;

const DRAFT_LEADS = [
  '24 hours in advance',
  '48 hours in advance',
  '3 days in advance',
  '1 week in advance',
];

interface Draft {
  request_kinds: string[];
  content_type: string;
  tied_to_event: boolean | null;
  event_date: string;
  event_time: string;
  event_location: string;
  rsvp_link: string;
  photos_video: 'have' | 'coming_soon' | 'none' | '';
  exact_wording: string;
  caption: string;
  reference: string;
  notes: string;
  platforms: string[];
  planned_publish: string;
  needs_submitter_approval: boolean | null;
  draft_lead: string;
}

const EMPTY: Draft = {
  request_kinds: [],
  content_type: '',
  tied_to_event: null,
  event_date: '',
  event_time: '',
  event_location: '',
  rsvp_link: '',
  photos_video: '',
  exact_wording: '',
  caption: '',
  reference: '',
  notes: '',
  platforms: [],
  planned_publish: '',
  needs_submitter_approval: null,
  draft_lead: '',
};

interface Uploaded {
  key: string;
  path: string;
  kind: 'resource' | 'media';
  url: string;
  name: string;
}

export function RequestWizard({
  fnUrl,
  token,
  headers,
  networks,
  reviewer,
  onDone,
  onCancel,
}: {
  fnUrl: string;
  token: string;
  headers: Record<string, string>;
  networks: string[];
  reviewer: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const requestId = useRef(crypto.randomUUID()).current;
  const [d, setD] = useState<Draft>(EMPTY);
  const [step, setStep] = useState(0);
  const [resources, setResources] = useState<Uploaded[]>([]);
  const [media, setMedia] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggle = (k: 'request_kinds' | 'platforms', v: string) =>
    setD((p) => ({
      ...p,
      [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v],
    }));

  // every network is pickable — even ones the app can't publish to yet, so the
  // request can still be planned and scheduled. Connected ones get a live dot.
  const platformOpts = Object.keys(NETWORKS) as NetworkId[];
  const connected = new Set(networks);

  // steps shown depend on the "tied to an event" answer
  const steps = useMemo(
    () =>
      ['basics', d.tied_to_event ? 'event' : null, 'media', 'post'].filter(Boolean) as string[],
    [d.tied_to_event],
  );
  const current = steps[step];
  const isLast = step === steps.length - 1;

  async function signAndUpload(file: File, kind: 'resource' | 'media'): Promise<Uploaded> {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        action: 'sign-upload',
        request_id: requestId,
        filename: file.name,
        kind,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Upload failed');
    const put = await fetch(body.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!put.ok) throw new Error('Upload failed');
    return {
      key: body.path,
      path: body.path,
      kind,
      url: URL.createObjectURL(file),
      name: file.name,
    };
  }

  async function addFiles(files: File[], kind: 'resource' | 'media') {
    setErr(null);
    setUploading(true);
    try {
      const done: Uploaded[] = [];
      for (const f of files) done.push(await signAndUpload(f, kind));
      if (kind === 'resource') setResources((p) => [...p, ...done]);
      else setMedia((p) => [...p, ...done]);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    } finally {
      setUploading(false);
    }
  }

  function stepError(): string | null {
    if (current === 'basics') {
      if (!d.request_kinds.length) return 'Pick at least one kind of request.';
      if (!d.content_type) return 'Pick what kind of content you need.';
      if (d.tied_to_event === null) return 'Let us know if this is tied to a date.';
    }
    if (current === 'event') {
      if (!d.event_date) return 'Add the event date.';
      if (!d.event_location.trim()) return 'Add the location (or note it is TBD).';
    }
    if (current === 'media' && !d.photos_video) return 'Let us know about photos or video.';
    if (current === 'post') {
      if (!d.caption.trim() && !d.exact_wording.trim() && !d.notes.trim())
        return 'Add a caption, exact wording, or a note so we know what to make.';
      if (!d.platforms.length) return 'Pick at least one platform.';
      if (d.needs_submitter_approval === null) return 'Let us know if you need to approve the draft.';
    }
    return null;
  }

  function next() {
    const e = stepError();
    if (e) {
      setErr(e);
      return;
    }
    setErr(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  async function submit() {
    const e = stepError();
    if (e) {
      setErr(e);
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'request',
          request_id: requestId,
          request: {
            request_kinds: d.request_kinds,
            content_type: d.content_type,
            tied_to_event: !!d.tied_to_event,
            event_date: d.tied_to_event ? d.event_date || null : null,
            event_time: d.tied_to_event ? d.event_time : null,
            event_location: d.tied_to_event ? d.event_location : null,
            rsvp_link: d.tied_to_event ? d.rsvp_link : null,
            photos_video: d.photos_video || null,
            exact_wording: d.exact_wording,
            caption: d.caption,
            reference: d.reference,
            notes: d.notes,
            platforms: d.platforms,
            planned_publish: d.planned_publish || null,
            needs_submitter_approval: !!d.needs_submitter_approval,
            draft_lead: d.needs_submitter_approval ? d.draft_lead : null,
          },
          media: [...resources, ...media].map((m) => ({
            path: m.path,
            kind: m.kind,
            filename: m.name,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not send the request.');
      setSubmitted(true);
    } catch (e2) {
      setErr(String((e2 as Error)?.message ?? e2));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Check className="mx-auto size-6 text-[color:var(--pf-olive)]" />
        <p className="mt-3 text-sm">
          Sent to {reviewer || 'your team'}. You'll see it here once it's drafted and scheduled —
          this link stays the same.
        </p>
        <Button variant="outline" className="mt-4" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  const asMediaItems = (u: Uploaded[]): MediaItem[] =>
    u.map((x) => ({ key: x.key, url: x.url, name: x.name }));

  return (
    <div className="rounded-xl border border-input bg-card p-5">
      {/* step rail */}
      <div className="mb-5 flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i <= step ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>
      <div className="dateline mb-4">
        Step {step + 1} of {steps.length}
      </div>

      {current === 'basics' && (
        <div className="space-y-5">
          <Field label="What kind of request is this?">
            <ChipGroup
              options={REQUEST_KINDS}
              selected={d.request_kinds}
              onToggle={(v) => toggle('request_kinds', v)}
            />
          </Field>
          <Field label="What kind of content do you need?">
            <ChipGroup
              options={CONTENT_TYPES}
              selected={d.content_type ? [d.content_type] : []}
              onToggle={(v) => set('content_type', d.content_type === v ? '' : v)}
            />
          </Field>
          <Field label="Is this tied to a specific event or date?">
            <YesNo value={d.tied_to_event} onChange={(v) => set('tied_to_event', v)} />
          </Field>
        </div>
      )}

      {current === 'event' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Only what should appear on the post — leaving out a required detail will hold things up.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event date">
              <Input
                type="date"
                value={d.event_date}
                onChange={(e) => set('event_date', e.target.value)}
              />
            </Field>
            <Field label="Event time">
              <Input
                placeholder="6:30 PM"
                value={d.event_time}
                onChange={(e) => set('event_time', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Location" hint="If it's TBD or given on RSVP, say so here.">
            <Input
              value={d.event_location}
              onChange={(e) => set('event_location', e.target.value)}
            />
          </Field>
          <Field label="RSVP link" hint="Type N/A if there's no link — nothing will be shown.">
            <Input value={d.rsvp_link} onChange={(e) => set('rsvp_link', e.target.value)} />
          </Field>
          <Field label="Any logos, QR codes, or files this post needs?">
            <MediaDropzone
              items={asMediaItems(resources)}
              max={10}
              onAdd={(f) => void addFiles(f, 'resource')}
              onRemove={(k) => setResources((p) => p.filter((x) => x.key !== k))}
            />
          </Field>
        </div>
      )}

      {current === 'media' && (
        <div className="space-y-4">
          <Field label="Do you have photos or video for this?">
            <ChipGroup
              options={PHOTO_OPTS.map((o) => o.l)}
              selected={
                d.photos_video ? [PHOTO_OPTS.find((o) => o.v === d.photos_video)!.l] : []
              }
              onToggle={(label) => {
                const opt = PHOTO_OPTS.find((o) => o.l === label)!;
                set('photos_video', d.photos_video === opt.v ? '' : opt.v);
              }}
            />
          </Field>
          {d.photos_video === 'have' && (
            <Field label="Upload them" hint="Images only for now — email larger video separately.">
              <MediaDropzone
                items={asMediaItems(media)}
                max={10}
                onAdd={(f) => void addFiles(f, 'media')}
                onRemove={(k) => setMedia((p) => p.filter((x) => x.key !== k))}
              />
            </Field>
          )}
        </div>
      )}

      {current === 'post' && (
        <div className="space-y-4">
          <Field
            label="Caption"
            hint="Required if the post states an official campaign position."
          >
            <Textarea
              rows={3}
              value={d.caption}
              onChange={(e) => set('caption', e.target.value)}
              placeholder="What the post should say…"
            />
          </Field>
          <Field label="Anything that must appear word-for-word?">
            <Textarea
              rows={2}
              value={d.exact_wording}
              onChange={(e) => set('exact_wording', e.target.value)}
            />
          </Field>
          <Field label="A post to base this on? (link)">
            <Input value={d.reference} onChange={(e) => set('reference', e.target.value)} />
          </Field>
          <Field label="Anything else?">
            <Textarea
              rows={2}
              value={d.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          <Field label="Platforms">
            <div className="flex flex-wrap gap-2">
              {platformOpts.map((id) => {
                const meta = NETWORKS[id];
                const Icon = meta.icon;
                const on = d.platforms.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle('platforms', id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-muted-foreground hover:border-muted-foreground',
                    )}
                  >
                    <Icon className="size-3.5" />
                    {meta.label}
                    {connected.has(id) && (
                      <span
                        className="size-1.5 rounded-full bg-[color:var(--pf-olive)]"
                        title="Connected — publishes automatically"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              A green dot means it's connected and posts automatically. The rest are still tracked
              and scheduled — someone posts them by hand for now.
            </p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Planned publish day">
              <Input
                type="date"
                value={d.planned_publish}
                onChange={(e) => set('planned_publish', e.target.value)}
              />
            </Field>
            <Field label="Approve the draft first?">
              <YesNo
                value={d.needs_submitter_approval}
                onChange={(v) => set('needs_submitter_approval', v)}
              />
            </Field>
          </div>
          {d.needs_submitter_approval && (
            <Field label="How far ahead do you want the first draft?">
              <ChipGroup
                options={DRAFT_LEADS}
                selected={d.draft_lead ? [d.draft_lead] : []}
                onToggle={(v) => set('draft_lead', d.draft_lead === v ? '' : v)}
              />
            </Field>
          )}
        </div>
      )}

      {err && <p className="mt-4 text-sm text-destructive">{err}</p>}
      {uploading && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Uploading…
        </p>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
          disabled={submitting}
        >
          <ArrowLeft className="size-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {isLast ? (
          <Button variant="action" onClick={() => void submit()} disabled={submitting || uploading}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Send request
          </Button>
        ) : (
          <Button onClick={next} disabled={uploading}>
            Next <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
  labels,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  labels?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              on
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-muted-foreground hover:border-muted-foreground',
            )}
          >
            {labels ? labels(o) : o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      {[
        { l: 'Yes', v: true },
        { l: 'No', v: false },
      ].map((o) => (
        <button
          key={o.l}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-xs transition-colors',
            value === o.v
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background text-muted-foreground hover:border-muted-foreground',
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
