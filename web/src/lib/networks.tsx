import type { ComponentType, SVGProps } from 'react';

export type NetworkId =
  | 'facebook'
  | 'instagram'
  | 'threads'
  | 'bluesky'
  | 'tiktok'
  | 'youtube';

type Glyph = ComponentType<SVGProps<SVGSVGElement>>;

const S = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  width: '1em',
  height: '1em',
  ...props,
});

const Facebook: Glyph = (p) => (
  <svg {...S(p)}>
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H17V3.6c-.3 0-1.3-.1-2.45-.1-2.42 0-4.05 1.47-4.05 4.18v2.32H7.8V13h2.7v8h3z" />
  </svg>
);
const Instagram: Glyph = (p) => (
  <svg {...S({ ...p, fill: 'none' })}>
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
  </svg>
);
const Threads: Glyph = (p) => (
  <svg {...S({ ...p, fill: 'none' })}>
    <path
      d="M12 21c-4.5 0-8-3.2-8-9s3.5-9 8-9c3.4 0 5.7 1.7 6.7 4.2M12 21c3 0 5.5-1.6 5.5-4.3 0-2.4-2-3.7-4.7-3.7-2 0-3.6 1-3.6 2.6 0 1.4 1.3 2.2 2.7 2.2 2.3 0 3.6-2 3.6-4.6 0-2.3-1.4-3.9-3.6-3.9-1.6 0-2.8.7-3.5 1.7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
const Bluesky: Glyph = (p) => (
  <svg {...S(p)}>
    <path d="M12 10.8C10.7 8.2 7.2 3.7 4 3.7c-1.9 0-2 2-2 3.3 0 1.3.7 5.5 1.2 6.2.9 1.4 2.6 1.6 4.2 1.3-2.8.5-3.4 2.5-1.9 4.3 1.5 1.8 3.9 3 6.5-2.2 2.6 5.2 5 4 6.5 2.2 1.5-1.8.9-3.8-1.9-4.3 1.6.3 3.3.1 4.2-1.3.5-.7 1.2-4.9 1.2-6.2 0-1.3-.1-3.3-2-3.3-3.2 0-6.7 4.5-8 7.1z" />
  </svg>
);
const TikTok: Glyph = (p) => (
  <svg {...S(p)}>
    <path d="M16.5 3c.3 2.1 1.5 3.6 3.5 4v3c-1.4 0-2.7-.4-3.8-1.1v6.4c0 3.4-2.5 5.7-5.7 5.7C7 21 4.7 18.7 4.7 15.7c0-3 2.4-5.3 5.6-5.2v3c-.4-.1-.9-.2-1.3-.1-1.2.1-2 1-2 2.3 0 1.3 1 2.3 2.3 2.3 1.3 0 2.2-.9 2.2-2.4V3h4z" />
  </svg>
);
const YouTube: Glyph = (p) => (
  <svg {...S(p)}>
    <path d="M21.6 7.2c-.2-1-.9-1.7-1.9-2C18 4.8 12 4.8 12 4.8s-6 0-7.7.4c-1 .3-1.7 1-1.9 2C2 8.9 2 12 2 12s0 3.1.4 4.8c.2 1 .9 1.7 1.9 2 1.7.4 7.7.4 7.7.4s6 0 7.7-.4c1-.3 1.7-1 1.9-2 .4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8zM10 15V9l5 3-5 3z" />
  </svg>
);

export interface NetworkMeta {
  id: NetworkId;
  label: string;
  /** brand accent — used only for the small dot / ring, never as a fill */
  color: string;
  icon: Glyph;
  limit: number;
  family: 'feed' | 'photo' | 'video';
  /** the adapter can publish a video file to this network today */
  video: boolean;
}

export const NETWORKS: Record<NetworkId, NetworkMeta> = {
  facebook: { id: 'facebook', label: 'Facebook', color: '#1877F2', icon: Facebook, limit: 63206, family: 'feed', video: true },
  instagram: { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: Instagram, limit: 2200, family: 'photo', video: true },
  threads: { id: 'threads', label: 'Threads', color: '#4b4b4b', icon: Threads, limit: 500, family: 'feed', video: true },
  bluesky: { id: 'bluesky', label: 'Bluesky', color: '#0085FF', icon: Bluesky, limit: 300, family: 'feed', video: false },
  tiktok: { id: 'tiktok', label: 'TikTok', color: '#4b4b4b', icon: TikTok, limit: 2200, family: 'video', video: false },
  youtube: { id: 'youtube', label: 'YouTube', color: '#FF0000', icon: YouTube, limit: 5000, family: 'video', video: false },
};

export const ALL_NETWORKS = Object.values(NETWORKS);

export function countGraphemes(text: string): number {
  return [...text].length;
}
