import { cn } from '@/lib/utils';

/** Small circular character-budget indicator, like the ones in a real composer. */
export function CharRing({
  count,
  limit,
  size = 18,
}: {
  count: number;
  limit: number;
  size?: number;
}) {
  const pct = Math.min(count / limit, 1);
  const over = count > limit;
  const near = !over && count / limit > 0.85;
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  const stroke = over
    ? 'var(--pf-brick)'
    : near
      ? 'var(--pf-coral)'
      : 'var(--pf-olive)';
  const remaining = limit - count;

  return (
    <span className="inline-flex items-center gap-1.5">
      {(near || over) && (
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums',
            over ? 'text-[color:var(--pf-brick)]' : 'text-[color:var(--pf-coral)]',
          )}
        >
          {remaining}
        </span>
      )}
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--pf-rule-strong)"
          strokeWidth="2"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
