import { ImagePlus, X } from 'lucide-react';
import { Dropzone, DropzoneEmptyState } from '@/components/kibo-ui/dropzone';

export interface MediaItem {
  key: string;
  url: string;
  name?: string;
  removing?: boolean;
}

export function MediaDropzone({
  items,
  max,
  onAdd,
  onRemove,
}: {
  items: MediaItem[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
}) {
  const room = max - items.length;

  return (
    <div className="space-y-2.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((m) => (
            <div key={m.key} className="relative">
              <img
                src={m.url}
                alt={m.name ?? ''}
                className="size-24 rounded-lg border border-input object-cover"
              />
              <button
                type="button"
                aria-label="Remove image"
                disabled={m.removing}
                onClick={() => onRemove(m.key)}
                className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border border-primary bg-background text-foreground shadow-sm hover:bg-secondary"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {room > 0 && (
        <Dropzone
          accept={{ 'image/*': [] }}
          maxFiles={room}
          onDrop={(accepted) => onAdd(accepted)}
          src={undefined}
          className="min-h-24"
        >
          <DropzoneEmptyState>
            <div className="flex flex-col items-center gap-1 py-1 text-muted-foreground">
              <ImagePlus className="size-5" />
              <p className="text-sm">
                Drop images or <span className="text-[color:var(--pf-brick)]">browse</span>
              </p>
              <p className="dateline">
                {room} more · up to {max}
              </p>
            </div>
          </DropzoneEmptyState>
        </Dropzone>
      )}
    </div>
  );
}
