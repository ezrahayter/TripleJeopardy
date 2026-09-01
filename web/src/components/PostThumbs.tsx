import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Read-only thumbnail strip for a post's stored images. */
export function PostThumbs({ postId, size = 72 }: { postId: string; size?: number }) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: rows } = await supabase
        .from('post_media')
        .select('storage_path')
        .eq('post_id', postId)
        .order('sort');
      const paths = (rows ?? []).map((r) => r.storage_path as string);
      if (paths.length === 0) {
        if (!cancelled) setUrls([]);
        return;
      }
      const { data: signed } = await supabase.storage.from('media').createSignedUrls(paths, 3600);
      const list = (signed ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
      if (!cancelled) setUrls(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (urls.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {urls.map((u, i) => (
        <img
          key={i}
          src={u}
          alt=""
          style={{ width: size, height: size }}
          className="rounded-md border border-input object-cover"
        />
      ))}
    </div>
  );
}
