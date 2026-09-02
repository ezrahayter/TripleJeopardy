import { useMemo, useState, type ReactNode } from 'react';
import {
  Bookmark,
  Heart,
  ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { NETWORKS, countGraphemes, type NetworkId } from '@/lib/networks';
import { cn } from '@/lib/utils';

export interface PreviewAccount {
  network: NetworkId;
  name: string;
  handle: string;
  avatarUrl?: string;
}

// ── shared bits ────────────────────────────────────────────────────

function highlight(text: string, accent: string) {
  return text.split(/(\s+)/).map((p, i) =>
    /^[@#][\w.]+$/.test(p) || /^https?:\/\//.test(p) ? (
      <span key={i} style={{ color: accent }}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Avatar({
  acct,
  color,
  size = 40,
  ring,
}: {
  acct: PreviewAccount;
  color: string;
  size?: number;
  ring?: string;
}) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: acct.avatarUrl ? undefined : color,
        fontSize: size * 0.4,
        boxShadow: ring ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : undefined,
      }}
    >
      {acct.avatarUrl ? (
        <img src={acct.avatarUrl} alt="" className="size-full rounded-full object-cover" />
      ) : (
        acct.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function MediaGrid({
  urls,
  rounded = 12,
  video = false,
}: {
  urls: string[];
  rounded?: number;
  video?: boolean;
}) {
  if (urls.length === 0) return null;
  if (video) {
    return (
      <video
        src={urls[0]}
        controls
        className="w-full bg-black object-contain"
        style={{ borderRadius: rounded, maxHeight: 430 }}
      />
    );
  }
  if (urls.length === 1) {
    return (
      <img
        src={urls[0]}
        alt=""
        className="w-full object-cover"
        style={{ borderRadius: rounded, maxHeight: 430 }}
      />
    );
  }
  return (
    <div
      className="grid gap-0.5 overflow-hidden"
      style={{ borderRadius: rounded, gridTemplateColumns: '1fr 1fr' }}
    >
      {urls.slice(0, 4).map((u, i) => (
        <img
          key={i}
          src={u}
          alt=""
          className={cn('aspect-square h-full w-full object-cover', urls.length === 3 && i === 0 && 'row-span-2')}
        />
      ))}
    </div>
  );
}

interface Body {
  acct: PreviewAccount;
  color: string;
  text: ReactNode;
  over: boolean;
  hasText: boolean;
  media: string[];
  mediaIsVideo?: boolean;
  firstComment: string;
}

// ── Bluesky / Threads — the reply-repost-like lineage ──────────────

function FeedPost({ b, network }: { b: Body; network: NetworkId }) {
  const bsky = network === 'bluesky';
  const muted = '#42576c';
  const border = '#e3e8ee';
  const handle = bsky ? `${b.acct.handle}.bsky.social` : b.acct.handle;
  return (
    <div
      className="overflow-hidden bg-white"
      style={{ borderRadius: 14, border: `1px solid ${border}`, color: '#0b1620' }}
    >
      <div className="flex gap-2.5 p-3.5">
        <Avatar acct={b.acct} color={b.color} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold leading-tight">{b.acct.name}</div>
              <div className="truncate text-[13px] leading-tight" style={{ color: muted }}>
                @{handle} · now
              </div>
            </div>
            <MoreHorizontal className="size-4 shrink-0" style={{ color: muted }} />
          </div>

          {b.hasText && (
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-normal">
              {b.text}
              {b.over && <span style={{ color: muted }}>…</span>}
            </p>
          )}

          {b.media.length > 0 && (
            <div className="mt-2">
              <MediaGrid urls={b.media} rounded={12} video={b.mediaIsVideo} />
            </div>
          )}

          <div
            className="mt-2.5 flex max-w-[280px] items-center justify-between text-[13px]"
            style={{ color: muted }}
          >
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-[18px]" /> 0
            </span>
            <span className="flex items-center gap-1.5">
              <Repeat2 className="size-[18px]" /> 0
            </span>
            <span className="flex items-center gap-1.5">
              <Heart className="size-[18px]" /> 0
            </span>
            <Send className="size-[17px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Facebook — labelled Like / Comment / Share bar ────────────────

function FacebookPost({ b }: { b: Body }) {
  const muted = '#65676b';
  return (
    <div
      className="overflow-hidden bg-white"
      style={{ borderRadius: 10, border: '1px solid #dcdfe4', color: '#050505' }}
    >
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5">
        <Avatar acct={b.acct} color={b.color} size={40} />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold">{b.acct.name}</div>
          <div className="text-[12px]" style={{ color: muted }}>
            Just now · Public
          </div>
        </div>
        <MoreHorizontal className="ml-auto size-5" style={{ color: muted }} />
      </div>

      {b.hasText && (
        <p className="whitespace-pre-wrap px-3.5 py-2.5 text-[15px] leading-normal">
          {b.text}
          {b.over && <span style={{ color: muted }}> … See more</span>}
        </p>
      )}

      {b.media.length > 0 && (
        <div className={cn(b.hasText ? '' : 'mt-2.5')}>
          <MediaGrid urls={b.media} rounded={0} video={b.mediaIsVideo} />
        </div>
      )}

      <div
        className="mt-1 flex items-center justify-around border-t px-2 py-1.5 text-[14px] font-semibold"
        style={{ borderColor: '#e5e7eb', color: muted }}
      >
        <span className="flex items-center gap-1.5 px-3 py-1">
          <ThumbsUp className="size-[18px]" /> Like
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1">
          <MessageCircle className="size-[18px]" /> Comment
        </span>
        <span className="flex items-center gap-1.5 px-3 py-1">
          <Send className="size-[18px]" /> Share
        </span>
      </div>

      {b.firstComment.trim() && <CommentRow b={b} bg="#f0f2f5" />}
    </div>
  );
}

// ── Instagram — image first, caption with inline username ─────────

function InstagramPost({ b }: { b: Body }) {
  return (
    <div
      className="overflow-hidden bg-white"
      style={{ borderRadius: 8, border: '1px solid #dbdbdb', color: '#000' }}
    >
      <div className="flex items-center gap-2.5 p-2.5">
        <Avatar acct={b.acct} color={b.color} size={30} ring="#d1257e" />
        <span className="text-[13px] font-semibold">{b.acct.handle}</span>
        <MoreHorizontal className="ml-auto size-4" />
      </div>

      {b.media.length > 0 ? (
        b.mediaIsVideo ? (
          <video src={b.media[0]} controls className="aspect-square w-full bg-black object-contain" />
        ) : (
          <img src={b.media[0]} alt="" className="aspect-square w-full object-cover" />
        )
      ) : (
        <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-[#fafafa] text-[#8e8e8e]">
          <ImageIcon className="size-7" />
          <span className="text-[12px]">Instagram needs an image or video</span>
        </div>
      )}

      <div className="flex items-center gap-4 px-3 pb-1 pt-2.5 text-[#262626]">
        <Heart className="size-[22px]" />
        <MessageCircle className="size-[22px]" />
        <Send className="size-[22px]" />
        <Bookmark className="ml-auto size-[22px]" />
      </div>

      {b.hasText && (
        <p className="whitespace-pre-wrap px-3 pb-3 text-[13px] leading-snug">
          <span className="font-semibold">{b.acct.handle}</span> {b.text}
          {b.over && <span className="text-[#8e8e8e]"> more</span>}
        </p>
      )}

      {b.firstComment.trim() && <CommentRow b={b} />}
    </div>
  );
}

// ── TikTok / YouTube — video framing placeholder ─────────────────

function VideoPost({ b, network }: { b: Body; network: NetworkId }) {
  const vertical = network === 'tiktok';
  return (
    <div
      className="overflow-hidden bg-black text-white"
      style={{ borderRadius: 12, border: '1px solid #111' }}
    >
      <div
        className={cn('relative w-full', vertical ? 'aspect-[9/16] max-h-[440px]' : 'aspect-video')}
      >
        {b.media.length > 0 ? (
          b.mediaIsVideo ? (
            <video src={b.media[0]} controls className="size-full object-contain" />
          ) : (
            <img src={b.media[0]} alt="" className="size-full object-cover opacity-90" />
          )
        ) : (
          <div className="grid size-full place-items-center bg-neutral-900 text-neutral-500">
            <span className="flex flex-col items-center gap-1.5 text-[12px]">
              <Play className="size-8" /> {NETWORKS[network].label} video
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="text-[13px] font-semibold">{b.acct.name}</div>
          {b.hasText && (
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] leading-snug">
              {b.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentRow({ b, bg }: { b: Body; bg?: string }) {
  return (
    <div className="flex gap-2 px-3 py-2.5" style={{ background: bg }}>
      <span
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
        style={{ background: b.color }}
      >
        {b.acct.name.slice(0, 1).toUpperCase()}
      </span>
      <p className="whitespace-pre-wrap text-[12px] leading-snug text-[#333]">
        <span className="font-semibold">{b.acct.handle}</span>{' '}
        {highlight(b.firstComment, b.color)}
      </p>
    </div>
  );
}

// ── shell ────────────────────────────────────────────────────────

export function PostPreview({
  networks,
  accounts,
  text,
  overrides = {},
  firstComment = '',
  mediaUrls,
  mediaIsVideo = false,
}: {
  networks: NetworkId[];
  accounts: Record<string, PreviewAccount | undefined>;
  text: string;
  overrides?: Record<string, string>;
  firstComment?: string;
  mediaUrls: string[];
  mediaIsVideo?: boolean;
}) {
  const [active, setActive] = useState<NetworkId | null>(null);
  const current = active && networks.includes(active) ? active : (networks[0] ?? null);

  const acct: PreviewAccount = useMemo(() => {
    if (current && accounts[current]) return accounts[current]!;
    return { network: current ?? 'bluesky', name: 'Your campaign', handle: 'campaign' };
  }, [current, accounts]);

  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Pick a network to see the preview.
      </div>
    );
  }

  const meta = NETWORKS[current];
  const effective = overrides[current]?.trim() || text;
  const over = countGraphemes(effective) > meta.limit;
  const shown = over ? [...effective].slice(0, meta.limit).join('') : effective;

  const body: Body = {
    acct,
    color: meta.color,
    text: highlight(shown, meta.color),
    over,
    hasText: effective.trim().length > 0,
    media: mediaUrls,
    mediaIsVideo,
    firstComment,
  };

  let card: ReactNode;
  if (current === 'facebook') card = <FacebookPost b={body} />;
  else if (current === 'instagram') card = <InstagramPost b={body} />;
  else if (current === 'tiktok' || current === 'youtube')
    card = <VideoPost b={body} network={current} />;
  else card = <FeedPost b={body} network={current} />;

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
                title={N.label}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md border transition-colors',
                  id === current
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      )}

      <div className="[filter:drop-shadow(0_10px_28px_rgba(38,38,31,0.16))]">{card}</div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        {meta.label} preview · the real thing may differ slightly
      </p>
    </div>
  );
}
