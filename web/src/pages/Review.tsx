import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

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
    <div className="review-wrap">
      <span className="wordmark">
        Triple Jeopardy
        <span className="firm">Positive Force</span>
      </span>

      {loading && <p className="muted">Loading…</p>}
      {err && !data && <p className="notice error">{err}</p>}

      {data && (
        <>
          <h1>Review a post</h1>
          <p className="sub">
            for <strong>{data.campaign}</strong>
            {data.reviewer ? ` · ${data.reviewer}` : ''}
          </p>

          <div className="review-card">
            {data.media.length > 0 && (
              <div className="review-media">
                {data.media.map((u, i) => (
                  <img key={i} src={u} alt="" />
                ))}
              </div>
            )}
            <p className="review-body">{data.body || <span className="muted">(no text)</span>}</p>
          </div>

          {done ? (
            <p className="notice">
              {done === 'approved'
                ? 'You approved this. The team has been notified — thanks.'
                : 'Sent back with your notes. The team has been notified — thanks.'}
            </p>
          ) : (
            <>
              <label htmlFor="note">Notes (required if requesting changes)</label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Looks good / change the second line / wrong photo…"
              />
              {err && <p className="notice error">{err}</p>}
              <div className="btnrow">
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('approved')}
                >
                  Approve
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => void decide('changes_requested')}
                >
                  Request changes
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
