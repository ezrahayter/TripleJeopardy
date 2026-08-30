import { runPublisher } from './publisher';
import { runTokenRefresh } from './refresh';

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
  // token refresh is cheap but doesn't need to run every minute
  let refresh: { checked: number; refreshed: number } | null = null;
  if (env.META_APP_ID && new Date().getUTCMinutes() % 15 === 0) {
    refresh = await runTokenRefresh(env).catch((e) => {
      console.error('token refresh error', String(e?.message ?? e));
      return null;
    });
  }
  return { publish, refresh };
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
