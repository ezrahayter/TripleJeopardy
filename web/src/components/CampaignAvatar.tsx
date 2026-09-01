import { cn } from '@/lib/utils';

const TINTS = [
  { bg: '#e8e3d6', fg: '#636b2f' }, // olive
  { bg: '#f3ddd2', fg: '#ac4a2a' }, // brick
  { bg: '#e3e0d4', fg: '#373831' }, // ink
  { bg: '#f6dfd4', fg: '#b8461f' }, // coral-deep
  { bg: '#e6e6da', fg: '#5a6b3a' },
];

function pick(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length]!;
}

export function CampaignAvatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const t = pick(name);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-mono font-semibold', className)}
      style={{
        width: size,
        height: size,
        background: t.bg,
        color: t.fg,
        fontSize: size * 0.36,
      }}
    >
      {initials || '—'}
    </span>
  );
}
