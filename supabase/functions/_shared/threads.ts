// Threads API OAuth helpers for the connect flow (Deno).
// The Threads API has its own OAuth host + token endpoints, separate from
// Facebook Login, but lives under the same Meta app. Verify during App Review.

const THREADS_GRAPH = 'https://graph.threads.net';

export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'].join(',');

export function threadsAuthorizeUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL('https://threads.net/oauth/authorize');
  u.searchParams.set('client_id', opts.appId);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('state', opts.state);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', THREADS_SCOPES);
  return u.toString();
}

/** code -> short-lived token + user id */
export async function threadsExchangeCode(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; user_id: string }> {
  const res = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.appId,
      client_secret: opts.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: opts.redirectUri,
      code: opts.code,
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    user_id?: string;
    error_message?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`threads code exchange failed (${res.status}): ${json.error_message ?? 'unknown'}`);
  }
  return { access_token: json.access_token, user_id: String(json.user_id) };
}

/** short-lived -> long-lived (~60 days) */
export async function threadsLongLived(opts: {
  appSecret: string;
  shortToken: string;
}): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `${THREADS_GRAPH}/access_token?${new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: opts.appSecret,
      access_token: opts.shortToken,
    })}`,
  );
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`threads long-lived exchange failed (${res.status}): ${json.error?.message ?? 'unknown'}`);
  }
  return { access_token: json.access_token, expires_in: json.expires_in ?? 5_184_000 };
}

export async function threadsProfile(
  token: string,
): Promise<{ id: string; username: string }> {
  const res = await fetch(
    `${THREADS_GRAPH}/v1.0/me?${new URLSearchParams({
      fields: 'id,username',
      access_token: token,
    })}`,
  );
  const json = (await res.json()) as { id?: string; username?: string; error?: { message?: string } };
  if (!res.ok || !json.id) {
    throw new Error(`threads profile fetch failed (${res.status}): ${json.error?.message ?? 'unknown'}`);
  }
  return { id: json.id, username: json.username ?? 'threads-user' };
}
