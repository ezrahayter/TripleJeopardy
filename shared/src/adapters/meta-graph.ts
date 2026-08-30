/**
 * Thin helpers over the Meta Graph API and the Threads API. Both are
 * form-encoded HTTP with an `access_token` param; responses are JSON with a
 * `{ error: { message } }` shape on failure.
 *
 * Written to spec against Graph API v21.0 / Threads API v1.0. Not yet exercised
 * against a live app - fill gaps during Meta App Review testing.
 */

export const GRAPH_VERSION = 'v21.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
export const THREADS_BASE = 'https://graph.threads.net/v1.0';

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function call<T>(
  url: string,
  method: 'GET' | 'POST',
  params: Record<string, string | undefined>,
): Promise<T> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) search.set(k, v);

  const res =
    method === 'GET'
      ? await fetch(`${url}?${search.toString()}`)
      : await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: search.toString(),
        });

  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) {
    throw new Error(`graph ${method} ${url} failed (${res.status}): ${json.error?.message ?? 'unknown'}`);
  }
  return json;
}

export function graphGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  return call<T>(`${GRAPH_BASE}/${path}`, 'GET', params);
}

export function graphPost<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  return call<T>(`${GRAPH_BASE}/${path}`, 'POST', params);
}

export function threadsGet<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  return call<T>(`${THREADS_BASE}/${path}`, 'GET', params);
}

export function threadsPost<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  return call<T>(`${THREADS_BASE}/${path}`, 'POST', params);
}

/** Poll a media container until it leaves IN_PROGRESS. Images usually finish
 *  immediately; video and carousels take a few seconds. */
interface ContainerStatus {
  status_code?: string;
  status?: string;
  error_message?: string;
}

export async function waitForContainer(
  base: 'graph' | 'threads',
  containerId: string,
  accessToken: string,
  { tries = 10, delayMs = 3000 } = {},
): Promise<void> {
  const params = { fields: 'status_code,status', access_token: accessToken };
  for (let i = 0; i < tries; i++) {
    const status =
      base === 'graph'
        ? await graphGet<ContainerStatus>(containerId, params)
        : await threadsGet<ContainerStatus>(containerId, params);
    const code = status.status_code ?? status.status;
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') {
      throw new Error(`media container ${code}: ${status.error_message ?? ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error('media container did not finish processing in time');
}
