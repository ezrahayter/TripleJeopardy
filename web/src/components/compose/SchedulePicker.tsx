import { CalendarClock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function fmt(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function atTime(base: Date, hh: number, mm = 0) {
  const d = new Date(base);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export function SchedulePicker({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const quick = [
    { label: 'This evening', date: atTime(now, 18) },
    { label: 'Tomorrow 9 AM', date: atTime(tomorrow, 9) },
    { label: 'Tomorrow 12 PM', date: atTime(tomorrow, 12) },
  ].filter((q) => q.date > now);

  const timeStr = value
    ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    : '09:00';

  function setDay(day?: Date) {
    if (!day) return;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(day);
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    onChange(d);
  }
  function setTime(str: string) {
    const [h, m] = str.split(':').map(Number);
    const d = value ? new Date(value) : new Date();
    d.setHours(h ?? 9, m ?? 0, 0, 0);
    onChange(d);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn(!value && 'text-muted-foreground')}>
            <CalendarClock className="size-4" />
            {value ? fmt(value) : 'Pick a date and time'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-wrap gap-1.5 border-b border-border p-3">
            {quick.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => onChange(q.date)}
                className="rounded-full border border-input bg-card px-2.5 py-1 text-xs hover:border-primary"
              >
                {q.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={setDay}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            autoFocus
          />
          <div className="flex items-center gap-2 border-t border-border p-3">
            <span className="dateline">Time</span>
            <Input
              type="time"
              value={timeStr}
              onChange={(e) => setTime(e.target.value)}
              className="w-32"
            />
          </div>
        </PopoverContent>
      </Popover>

      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear schedule"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
