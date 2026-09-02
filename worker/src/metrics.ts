import { createClient } from '@supabase/supabase-js';
import { decryptSecret } from '../../shared/src/crypto';
import { getAdapter } from '../../shared/src/adapters';
import type { Env } from './index';

// Pull engagement/reach for recently-published posts into post_targets.metrics.
// tj_targets_needing_metrics() caps the work: published in the last 30 days,
// not synced in the last 6h, 40 per run.

interface Target {
  id: string;
  social_account_id: string;
  external_post_id: string;
  org_id: string;
}

export async function runMetricsSync(env: Env): Promise<{ checked: number; synced: number }> {
  const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: targets, error } = await supa.rpc('tj_targets_needing_metrics');
  if (error) throw new Error(`metrics scan failed: ${error.message}`);

  let synced = 0;
  const now = () => new Date().toISOString();

  for (const t of (targets ?? []) as Target[]) {
    try {
      const { data: acct } = await supa
        .from('social_accounts')
        .select('network, handle, service_url, external_id, meta, secret_ciphertext')
        .eq('id', t.social_account_id)
        .single();
      if (!acct?.secret_ciphertext) {
        await supa.from('post_targets').update({ metrics_synced_at: now() }).eq('id', t.id);
        continue;
      }

      const adapter = getAdapter(acct.network);
      if (!adapter.fetchMetrics) {
        // network has no metrics support yet — stamp it so we stop re-checking
        await supa.from('post_targets').update({ metrics_synced_at: now() }).eq('id', t.id);
        continue;
      }

      const secret = await decryptSecret(acct.secret_ciphertext, env.TJ_ENCRYPTION_KEY);
      const metrics = await adapter.fetchMetrics({
        account: {
          handle: acct.handle,
          serviceUrl: acct.service_url,
          externalId: acct.external_id,
          meta: acct.meta ?? null,
        },
        secret,
        externalId: t.external_post_id,
      });

      await supa
        .from('post_targets')
        .update({ metrics, metrics_synced_at: now() })
        .eq('id', t.id);

      // one snapshot per target per UTC day — the last sync of the day wins
      await supa.from('metric_snapshots').upsert(
        {
          org_id: t.org_id,
          post_target_id: t.id,
          captured_on: new Date().toISOString().slice(0, 10),
          metrics,
        },
        { onConflict: 'post_target_id,captured_on' },
      );
      synced++;
    } catch (e) {
      // stamp anyway so a persistently-failing target waits the 6h gate
      await supa.from('post_targets').update({ metrics_synced_at: now() }).eq('id', t.id);
      console.error(`metrics sync failed for ${t.id}:`, String((e as Error)?.message ?? e));
    }
  }

  return { checked: targets?.length ?? 0, synced };
}
