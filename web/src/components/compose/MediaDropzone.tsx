import { Crop, Film, ImagePlus, X } from 'lucide-react';
import { Dropzone, DropzoneEmptyState } from '@/components/kibo-ui/dropzone';
import { MAX_VIDEO_MB, VIDEO_ACCEPT } from '@/lib/media';

export interface MediaItem {
  key: string;
  url: string;
  name?: string;
  alt?: string;
  removing?: boolean;
  video?: boolean;
  croppedFor?: string[];
}

export function MediaDropzone({
  items,
  max,
  onAdd,
  onRemove,
  onAltChange,
  onCrop,
  allowVideo = true,
}: {
  items: MediaItem[];
  max: number;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  onAltChange?: (key: string, alt: string) => void;
  onCrop?: (key: string) => void;
  allowVideo?: boolean;
}) {
  const hasVideo = items.some((m) => m.video);
  // a video takes the whole post — no room for anything else alongside it
  const room = hasVideo ? 0 : max - items.length;

  return (
    <div className="space-y-2.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((m) => (
            <div key={m.key} className={m.video ? 'w-40' : 'w-24'}>
              <div className="relative">
                {m.video ? (
                  <video
                    src={m.url}
                    controls
                    className="h-24 w-40 rounded-lg border border-input bg-black object-contain"
                  />
                ) : (
                  <img
                    src={m.url}
                    alt={m.name ?? ''}
                    className="size-24 rounded-lg border border-input object-cover"
                  />
                )}
                <button
                  type="button"
                  aria-label="Remove media"
                  disabled={m.removing}
                  onClick={() => onRemove(m.key)}
                  className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full border border-primary bg-background text-foreground shadow-sm hover:bg-secondary"
                >
                  <X className="size-3" />
                </button>
                {onCrop && !m.video && (
                  <button
                    type="button"
                    aria-label="Crop for a network"
                    onClick={() => onCrop(m.key)}
                    className="absolute -bottom-2 -right-2 grid size-5 place-items-center rounded-full border border-primary bg-background text-foreground shadow-sm hover:bg-secondary"
                  >
                    <Crop className="size-3" />
                  </button>
                )}
              </div>
              {m.croppedFor && m.croppedFor.length > 0 && (
                <p className="dateline mt-1 truncate">crop: {m.croppedFor.join(', ')}</p>
              )}
              {onAltChange && !m.video && (
                <input
                  value={m.alt ?? ''}
                  onChange={(e) => onAltChange(m.key, e.target.value)}
                  placeholder="Alt text"
                  className="mt-1 w-full rounded border border-input bg-transparent px-1.5 py-0.5 text-[11px] placeholder:text-muted-foreground"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {room > 0 && (
        <Dropzone
          accept={allowVideo ? { 'image/*': [], ...VIDEO_ACCEPT } : { 'image/*': [] }}
          maxFiles={room}
          onDrop={(accepted) => onAdd(accepted)}
          src={undefined}
          className="min-h-24"
        >
          <DropzoneEmptyState>
            <div className="flex flex-col items-center gap-1 py-1 text-muted-foreground">
              {allowVideo ? <Film className="size-5" /> : <ImagePlus className="size-5" />}
              <p className="text-sm">
                Drop {allowVideo ? 'images or a video' : 'images'} or{' '}
                <span className="text-[color:var(--pf-brick)]">browse</span>
              </p>
              <p className="dateline">
                {items.length === 0 && allowVideo
                  ? `up to ${max} images, or one video (max ${MAX_VIDEO_MB} MB)`
                  : `${room} more · up to ${max}`}
              </p>
            </div>
          </DropzoneEmptyState>
        </Dropzone>
      )}
    </div>
  );
}
