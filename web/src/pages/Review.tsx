import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ReviewData {
  campaign: string;
  reviewer: string | null;
  body: string;
  media: string[];
  decided: boolean;
  decision: string | null;
  error?: string;
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/review`;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

export function Review() {
  const { token } = useParams();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${FN}?token=${token}`, { headers });
        const body = (await res.json()) as ReviewData;
        if (!res.ok) setErr(body.error ?? 'Could not load this review.');
        else {
          setData(body);
          if (body.decided) setDone(body.decision);
        }
      } catch {
        setErr('Could not reach the server.');
      }
      setLoading(false);
    })();
  }, [token]);

  async function decide(decision: 'approved' | 'changes_requested') {
    if (decision === 'changes_requested' && !note.trim()) {
      setErr('Add a quick note on what to change.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(FN, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ token, decision, note }),
      });
      const body = await res.json();
      if (!res.ok) setErr(body.error ?? 'Something went wrong.');
      else setDone(decision);
    } catch {
      setErr('Could not reach the server.');
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <div className="mb-8">
        <div className="font-display text-lg font-black tracking-tight">Triple Jeopardy</div>
        <div className="dateline mt-1">Positive Force</div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {err && !data && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <>
          <h1 className="text-2xl font-black tracking-tight">Review a post</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            for <strong>{data.campaign}</strong>
            {data.reviewer ? ` · ${data.reviewer}` : ''}
          </p>

          <div className="mt-5 rounded-lg border border-input bg-card p-4">
            {data.media.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {data.media.map((u, i) => (
                  <img key={i} src={u} alt="" className="max-w-full rounded-md border border-border" />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
              {data.body || <span className="text-muted-foreground">(no text)</span>}
            </p>
          </div>

          {done ? (
            <p className="mt-5 rounded-md border-l-2 border-action bg-card px-4 py-3 text-sm">
              {done === 'approved'
                ? 'You approved this. The team has been notified — thanks.'
                : 'Sent back with your notes. The team has been notified — thanks.'}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="note">Notes (required if requesting changes)</Label>
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Looks good / change the second line / wrong photo…"
                  rows={4}
                />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <div className="flex gap-2">
                <Button variant="action" disabled={busy} onClick={() => void decide('approved')}>
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void decide('changes_requested')}
                >
                  Request changes
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
