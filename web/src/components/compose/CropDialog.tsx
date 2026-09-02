import { useCallback, useRef, useState } from 'react';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const RATIOS: { label: string; value: number | undefined }[] = [
  { label: 'Square 1:1', value: 1 },
  { label: 'Portrait 4:5', value: 4 / 5 },
  { label: 'Landscape 1.91:1', value: 1.91 },
  { label: 'Wide 16:9', value: 16 / 9 },
  { label: 'Story 9:16', value: 9 / 16 },
  { label: 'Free', value: undefined },
];

function initialCrop(w: number, h: number, aspect: number | undefined): Crop {
  if (!aspect) return { unit: '%', x: 5, y: 5, width: 90, height: 90 };
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, w, h),
    w,
    h,
  );
}

async function renderCrop(
  img: HTMLImageElement,
  crop: PixelCrop,
  name: string,
): Promise<File> {
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(crop.width * scaleX);
  canvas.height = Math.round(crop.height * scaleY);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', 0.9),
  );
  if (!blob) throw new Error('Could not render the crop.');
  const base = name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${base}-crop.jpg`, { type: 'image/jpeg' });
}

export function CropDialog({
  src,
  name,
  networks,
  existingCropNetworks,
  onApply,
  onClose,
}: {
  src: string;
  name: string;
  /** networks selected for this post — the crop-target options */
  networks: NetworkId[];
  existingCropNetworks: NetworkId[];
  onApply: (result: { networks: NetworkId[]; file: File }) => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop>();
  const [targets, setTargets] = useState<NetworkId[]>(networks);
  const [busy, setBusy] = useState(false);

  const onLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      setCrop(initialCrop(width, height, aspect));
    },
    [aspect],
  );

  function pickRatio(value: number | undefined) {
    setAspect(value);
    const el = imgRef.current;
    if (el) setCrop(initialCrop(el.width, el.height, value));
  }

  async function apply() {
    if (!imgRef.current || !completed?.width || targets.length === 0) return;
    setBusy(true);
    try {
      const file = await renderCrop(imgRef.current, completed, name);
      onApply({ networks: targets, file });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop for a network</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {RATIOS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => pickRatio(r.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs',
                aspect === r.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex justify-center overflow-hidden rounded-md border border-border bg-[color:var(--pf-paper-sunk)]">
          <ReactCrop
            crop={crop}
            aspect={aspect}
            onChange={(_, percent) => setCrop(percent)}
            onComplete={(px) => setCompleted(px)}
            className="max-h-[50vh]"
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              crossOrigin="anonymous"
              onLoad={onLoad}
              className="max-h-[50vh] w-auto"
            />
          </ReactCrop>
        </div>

        <div className="space-y-1.5">
          <p className="dateline">Apply this crop to</p>
          <div className="flex flex-wrap gap-1.5">
            {networks.map((id) => {
              const on = targets.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setTargets((t) => (on ? t.filter((x) => x !== id) : [...t, id]))
                  }
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-card text-muted-foreground',
                  )}
                >
                  {NETWORKS[id].label}
                  {existingCropNetworks.includes(id) && !on ? ' · has crop' : ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !completed?.width || targets.length === 0} onClick={() => void apply()}>
            {busy ? 'Cropping…' : `Apply to ${targets.length}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
