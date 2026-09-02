import { NETWORKS, countGraphemes, type NetworkId } from '@/lib/networks';
import { CharRing } from './CharRing';
import { cn } from '@/lib/utils';

export function NetworkPicker({
  available,
  selected,
  onToggle,
  text,
  incompatible = [],
}: {
  available: NetworkId[];
  selected: NetworkId[];
  onToggle: (id: NetworkId) => void;
  text: string;
  incompatible?: NetworkId[];
}) {
  const count = countGraphemes(text);
  return (
    <div className="flex flex-wrap gap-2">
      {available.map((id) => {
        const n = NETWORKS[id];
        const on = selected.includes(id);
        const bad = on && incompatible.includes(id);
        const Icon = n.icon;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(id)}
            title={bad ? `${n.label} can't post video yet` : undefined}
            className={cn(
              'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              bad
                ? 'border-destructive bg-destructive/10 text-destructive'
                : on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className={cn('font-medium', bad && 'line-through')}>{n.label}</span>
            {on && !bad && count > 0 && <CharRing count={count} limit={n.limit} />}
          </button>
        );
      })}
    </div>
  );
}
