// Local-dev only: pokes the worker's /run endpoint every 30s so scheduled posts
// actually publish without you curling by hand. In production the Cloudflare
// cron does this. Reads the trigger secret from worker/.dev.vars.

import { readFileSync } from 'node:fs';

const INTERVAL_MS = 30_000;
const RUN_URL = 'http://localhost:8787/run';

let secret = '';
try {
  const vars = readFileSync(new URL('../worker/.dev.vars', import.meta.url), 'utf8');
  secret = vars.match(/WORKER_TRIGGER_SECRET\s*=\s*"?([^"\n]+)"?/)?.[1] ?? '';
} catch {
  console.warn('dev-tick: worker/.dev.vars not found - the worker may reject /run');
}

async function tick() {
  try {
    const res = await fetch(RUN_URL, {
      method: 'POST',
      headers: { 'x-trigger-secret': secret },
    });
    if (!res.ok) return;
    const body = await res.json();
    const p = body?.publish;
    if (p?.claimed) {
      console.log(`[tick ${new Date().toLocaleTimeString()}]`, JSON.stringify(p.results));
    }
  } catch {
    // worker not up yet - ignore and try again next interval
  }
}

console.log(`dev-tick: POST ${RUN_URL} every ${INTERVAL_MS / 1000}s`);
setInterval(tick, INTERVAL_MS);
tick();
