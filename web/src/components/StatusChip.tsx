import { cn } from '@/lib/utils';
import type { ApprovalState } from '@shared/types';

const base =
  'inline-flex items-center gap-1.5 rounded font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-[3px] border';

const STATUS: Record<string, string> = {
  draft: 'border-input text-muted-foreground',
  scheduled: 'border-action/60 text-[color:var(--pf-brick)]',
  publishing: 'border-action/60 text-[color:var(--pf-brick)]',
  published: 'bg-[color:var(--pf-olive)] border-[color:var(--pf-olive)] text-[color:var(--pf-bone)]',
  failed: 'bg-destructive border-destructive text-white',
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={cn(base, STATUS[status] ?? 'border-input text-muted-foreground')}>{status}</span>
  );
}

const APPROVAL: Record<ApprovalState, { label: string; cls: string }> = {
  not_required: { label: 'not sent', cls: 'border-input text-muted-foreground' },
  pending: { label: 'in review', cls: 'border-action text-[color:var(--pf-brick)]' },
  changes_requested: {
    label: 'needs changes',
    cls: 'border-destructive text-destructive',
  },
  approved: {
    label: 'approved',
    cls: 'bg-primary border-primary text-primary-foreground',
  },
};

export function ApprovalChip({ state }: { state: ApprovalState }) {
  const s = APPROVAL[state];
  return <span className={cn(base, s.cls)}>{s.label}</span>;
}
