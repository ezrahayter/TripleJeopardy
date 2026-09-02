import { cn } from '@/lib/utils';
import { campaignTint } from '@/lib/campaignColor';

export function CampaignAvatar({
  name,
  size = 36,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const t = campaignTint(name);
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
