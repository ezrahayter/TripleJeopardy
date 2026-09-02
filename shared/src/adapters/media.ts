/** Shared media-type helpers for the adapters and the worker. */

const IMAGE_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const VIDEO_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
};

/** Best-effort MIME from a storage path or filename. Defaults to image/jpeg. */
export function guessMime(pathOrName: string): string {
  const ext = pathOrName.split('.').pop()?.toLowerCase().split(/[?#]/)[0] ?? '';
  return VIDEO_EXT[ext] ?? IMAGE_EXT[ext] ?? 'image/jpeg';
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/');
}

/** Networks that fetch by URL cap the video size they'll pull; keep a sane
 *  ceiling so the worker never tries to hand off something absurd. */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
