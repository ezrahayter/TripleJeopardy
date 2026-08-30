import { runPublisher } from './publisher';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  TJ_ENCRYPTION_KEY: string;
  WORKER_TRIGGER_SECRET?: string;
}

export default {
  // Cron: */1 * * * * (see wrangler.toml)
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runPublisher(env).then((r) => console.log('cron run', JSON.stringify(r))));
  },

  // Manual trigger for local dev / debugging: POST /run
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/run' && req.method === 'POST') {
      if (
        env.WORKER_TRIGGER_SECRET &&
        req.headers.get('x-trigger-secret') !== env.WORKER_TRIGGER_SECRET
      ) {
        return new Response('forbidden\n', { status: 403 });
      }
      const result = await runPublisher(env);
      return Response.json(result);
    }

    return new Response('triple-jeopardy publisher - POST /run to trigger\n');
  },
};
