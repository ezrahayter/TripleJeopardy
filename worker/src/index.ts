import { runPublisher } from './publisher';
import { runTokenRefresh } from './refresh';
import { runMetricsSync } from './metrics';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TJ_ENCRYPTION_KEY: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  WORKER_TRIGGER_SECRET?: string;
}

async function tick(env: Env) {
  const publish = await runPublisher(env);
  const minute = new Date().getUTCMinutes();

  // token refresh is cheap but doesn't need to run every minute
  let refresh: { checked: number; refreshed: number } | null = null;
  if (env.META_APP_ID && minute % 15 === 0) {
    refresh = await runTokenRefresh(env).catch((e) => {
      console.error('token refresh error', String(e?.message ?? e));
      return null;
    });
  }

  // engagement/reach sync — every 10 min; the RPC's 6h gate throttles per-post
  let metrics: { checked: number; synced: number } | null = null;
  if (minute % 10 === 0) {
    metrics = await runMetricsSync(env).catch((e) => {
      console.error('metrics sync error', String(e?.message ?? e));
      return null;
    });
  }

  // review nudges — every 30 min, handled by an edge function that can email
  let nudges: unknown = null;
  if (minute % 30 === 0 && env.WORKER_TRIGGER_SECRET) {
    nudges = await fetch(`${env.SUPABASE_URL}/functions/v1/run-nudges`, {
      method: 'POST',
      headers: { 'x-trigger-secret': env.WORKER_TRIGGER_SECRET },
    })
      .then((r) => r.json())
      .catch((e) => {
        console.error('nudge run error', String(e?.message ?? e));
        return null;
      });
  }

  // weekly performance digest — Monday 13:00 UTC; the edge fn guards per-day
  let digests: unknown = null;
  const nowUtc = new Date();
  if (
    env.WORKER_TRIGGER_SECRET &&
    nowUtc.getUTCDay() === 1 &&
    nowUtc.getUTCHours() === 13 &&
    minute === 0
  ) {
    digests = await fetch(`${env.SUPABASE_URL}/functions/v1/run-digests`, {
      method: 'POST',
      headers: { 'x-trigger-secret': env.WORKER_TRIGGER_SECRET },
    })
      .then((r) => r.json())
      .catch((e) => {
        console.error('digest run error', String(e?.message ?? e));
        return null;
      });
  }

  return { publish, refresh, metrics, nudges, digests };
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(tick(env).then((r) => console.log('cron', JSON.stringify(r))));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/run' && req.method === 'POST') {
      if (
        env.WORKER_TRIGGER_SECRET &&
        req.headers.get('x-trigger-secret') !== env.WORKER_TRIGGER_SECRET
      ) {
        return new Response('forbidden\n', { status: 403 });
      }
      return Response.json(await tick(env));
    }

    return new Response('triple-jeopardy publisher - POST /run to trigger\n');
  },
};
