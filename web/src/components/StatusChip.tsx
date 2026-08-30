import type { PostStatus, TargetStatus, JobStatus } from '@shared/types';

export function StatusChip({ status }: { status: PostStatus | TargetStatus | JobStatus | string }) {
  return (
    <span className="chip" data-status={status}>
      <span className="dot" />
      {status}
    </span>
  );
}
