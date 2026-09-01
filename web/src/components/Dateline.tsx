import { cn } from '@/lib/utils';
import { NETWORK_LABEL, shortWhen } from '@/lib/format';

/** Wire-service slug: CAMPAIGN / NETWORK · WHEN */
export function Dateline({
  campaign,
  network,
  when,
  fallback = 'Unscheduled draft',
  className,
}: {
  campaign?: string | null;
  network?: string | null;
  when?: string | null;
  fallback?: string;
  className?: string;
}) {
  const empty = !campaign && !network && !when;
  return (
    <div className={cn('dateline flex flex-wrap items-center gap-x-2 gap-y-0.5', className)}>
      {campaign && <span>{campaign}</span>}
      {network && (
        <>
          {campaign && <span className="opacity-40">/</span>}
          <span>{NETWORK_LABEL[network] ?? network}</span>
        </>
      )}
      {when && (
        <>
          {(campaign || network) && <span className="opacity-40">·</span>}
          <span>{shortWhen(when)}</span>
        </>
      )}
      {empty && <span className="opacity-60">{fallback}</span>}
    </div>
  );
}
