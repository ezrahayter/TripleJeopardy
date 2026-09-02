import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface TopPost {
  body: string;
  network: string;
  url: string | null;
  engagement: number;
  reach: number;
  published_at: string | null;
}
interface ReportData {
  campaign: string;
  generatedAt: string;
  recap: string | null;
  recapAt: string | null;
  stats: {
    published: number;
    last30: number;
    engagement: number;
    reach: number;
    byNetwork: Record<string, number>;
  };
  top: TopPost[];
  trend: { day: string; engagement: number; reach: number }[];
  error?: string;
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report`;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(n);
}

export function Report() {
  const { token } = useParams();
  const [data, setData] = useState<ReportData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FN}?token=${token}`, {
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
        });
        const body = (await res.json()) as ReportData;
        if (!res.ok) setErr(body.error ?? 'Could not load this report.');
        else setData(body);
      } catch {
        setErr('Could not reach the server.');
      }
    })();
  }, [token]);

  const maxTrend = Math.max(1, ...(data?.trend ?? []).map((d) => d.engagement));

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-10">
        <div className="font-display text-lg font-black tracking-tight">Triple Jeopardy</div>
        <div className="dateline mt-1">Positive Force</div>
      </div>

      {err && <p className="text-sm text-destructive">{err}</p>}

      {data && (
        <>
          <h1 className="font-display text-3xl font-black tracking-tight">{data.campaign}</h1>
          <p className="dateline mt-1">
            Social performance · updated {new Date(data.generatedAt).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
            })}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Posts published', value: String(data.stats.published) },
              { label: 'Last 30 days', value: String(data.stats.last30) },
              { label: 'Engagement', value: fmt(data.stats.engagement) },
              { label: 'Reach', value: fmt(data.stats.reach) },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-border bg-card p-4">
                <div className="font-display text-2xl font-black">{t.value}</div>
                <div className="dateline mt-1">{t.label}</div>
              </div>
            ))}
          </div>

          {data.recap && (
            <div className="mt-8 rounded-lg border border-border bg-card p-5">
              <h2 className="dateline mb-2">The story so far</h2>
              {data.recap.split('\n').filter(Boolean).map((p, i) => (
                <p key={i} className="mt-2 text-[15px] leading-relaxed first:mt-0">
                  {p}
                </p>
              ))}
            </div>
          )}

          {data.trend.length > 1 && (
            <div className="mt-8">
              <h2 className="dateline mb-3">Engagement, last 45 days</h2>
              <div className="flex h-28 items-end gap-1">
                {data.trend.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day}: ${d.engagement}`}
                    className="flex-1 rounded-t bg-[color:var(--pf-coral)]"
                    style={{ height: `${Math.max(2, (d.engagement / maxTrend) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          {data.top.length > 0 && (
            <div className="mt-8">
              <h2 className="dateline mb-3">Top posts</h2>
              <ol className="space-y-2">
                {data.top.map((p, i) => (
                  <li key={i} className="rounded-lg border border-border bg-card p-4">
                    <div className="dateline flex justify-between">
                      <span>{p.network}</span>
                      <span>
                        {fmt(p.engagement)} interactions
                        {p.reach ? ` · ${fmt(p.reach)} reach` : ''}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed">{p.body}</p>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="dateline mt-1.5 inline-block text-[color:var(--pf-brick)]"
                      >
                        View post
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <p className="dateline mt-12 border-t border-border pt-4">
            Prepared by Positive Force with Triple Jeopardy
          </p>
        </>
      )}
    </div>
  );
}
