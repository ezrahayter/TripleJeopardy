/** Client-side media-type helpers, mirroring shared/src/adapters/media.ts. */

export const MAX_VIDEO_MB = 200;
export const VIDEO_ACCEPT = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-m4v': ['.m4v'],
  'video/webm': ['.webm'],
} as const;

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url);
}
