import { useMemo, useState } from 'react';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from 'lucide-react';
import { NETWORKS, countGraphemes, type NetworkId } from '@/lib/networks';
import { cn } from '@/lib/utils';

export interface PreviewAccount {
  network: NetworkId;
  name: string;
  handle: string;
  avatarUrl?: string;
}

function highlight(text: string) {
  // light styling for @mentions, #hashtags, and links
  const parts = text.split(/(\s+)/);
  return parts.map((p, i) => {
    if (/^[@#][\w.]+$/.test(p) || /^https?:\/\//.test(p)) {
      return (
        <span key={i} className="text-[color:var(--pf-brick)]">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function MediaGrid({ urls, square }: { urls: string[]; square?: boolean }) {
  if (urls.length === 0) return null;
  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt=""
        className={cn(
          'w-full rounded-lg border border-border object-cover',
          square ? 'aspect-square' : 'max-h-[420px]',
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        'grid gap-1 overflow-hidden rounded-lg border border-border',
        urls.length === 2 && 'grid-cols-2',
        urls.length === 3 && 'grid-cols-2',
        urls.length >= 4 && 'grid-cols-2',
      )}
    >
      {urls.slice(0, 4).map((u, i) => (
        <img
          key={i}
          src={u}
          alt=""
          className={cn(
            'h-full w-full object-cover',
            urls.length === 3 && i === 0 && 'row-span-2',
            'aspect-square',
          )}
        />
      ))}
    </div>
  );
}

export function PostPreview({
  networks,
  accounts,
  text,
  overrides = {},
  firstComment = '',
  mediaUrls,
}: {
  networks: NetworkId[];
  accounts: Record<string, PreviewAccount | undefined>;
  text: string;
  overrides?: Record<string, string>;
  firstComment?: string;
  mediaUrls: string[];
}) {
  const [active, setActive] = useState<NetworkId | null>(null);
  const current = active && networks.includes(active) ? active : (networks[0] ?? null);

  const acct: PreviewAccount = useMemo(() => {
    if (current && accounts[current]) return accounts[current]!;
    return {
      network: current ?? 'bluesky',
      name: 'Your campaign',
      handle: 'campaign',
    };
  }, [current, accounts]);

  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Pick a network to preview the post.
      </div>
    );
  }

  const meta = NETWORKS[current];
  const effective = overrides[current]?.trim() || text;
  const over = countGraphemes(effective) > meta.limit;
  const shown = over ? [...effective].slice(0, meta.limit).join('') : effective;
  const photo = meta.family === 'photo';

  return (
    <div>
      {networks.length > 1 && (
        <div className="mb-3 flex gap-1.5">
          {networks.map((id) => {
            const N = NETWORKS[id];
            const Icon = N.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                aria-pressed={id === current}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md border transition-colors',
                  id === current
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground hover:text-foreground',
                )}
                title={N.label}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-[#fff] text-[#111] shadow-[0_1px_2px_rgba(55,56,49,0.06),0_10px_30px_-14px_rgba(55,56,49,0.22)]">
        <div className="flex items-center gap-2.5 p-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
            style={{ background: meta.color }}
          >
            {acct.avatarUrl ? (
              <img src={acct.avatarUrl} alt="" className="size-full rounded-full object-cover" />
            ) : (
              acct.name.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{acct.name}</div>
            <div className="truncate text-xs text-[#666]">
              {photo ? `@${acct.handle}` : `@${acct.handle} · now`}
            </div>
          </div>
          <MoreHorizontal className="ml-auto size-4 text-[#999]" />
        </div>

        {photo && mediaUrls.length > 0 && (
          <MediaGrid urls={mediaUrls} square />
        )}

        {effective.trim() && (
          <p className="whitespace-pre-wrap px-3 py-2.5 text-[14px] leading-relaxed">
            {highlight(shown)}
            {over && <span className="text-[#999]">… more</span>}
          </p>
        )}

        {!photo && mediaUrls.length > 0 && (
          <div className="px-3 pb-2">
            <MediaGrid urls={mediaUrls} />
          </div>
        )}

        <div className="flex items-center gap-5 border-t border-[#eee] px-3 py-2 text-[#888]">
          <Heart className="size-[18px]" />
          <MessageCircle className="size-[18px]" />
          <Repeat2 className="size-[18px]" />
          {photo ? (
            <Bookmark className="ml-auto size-[18px]" />
          ) : (
            <Send className="ml-auto size-[18px]" />
          )}
        </div>

        {firstComment.trim() && (
          <div className="flex gap-2 border-t border-[#eee] px-3 py-2.5">
            <span
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: meta.color }}
            >
              {acct.name.slice(0, 1).toUpperCase()}
            </span>
            <p className="whitespace-pre-wrap text-[13px] leading-snug text-[#333]">
              {highlight(firstComment)}
            </p>
          </div>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        Preview · {meta.label}. Actual rendering varies by platform.
      </p>
    </div>
  );
}
