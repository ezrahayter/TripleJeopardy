// Facebook Login + Graph API OAuth helpers for the connect flow (Deno).
// Graph API v21.0. Written to spec; verify against a live app during App Review.

const GRAPH = 'https://graph.facebook.com/v21.0';

export const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'business_management',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

export function metaAuthorizeUrl(opts: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  u.searchParams.set('client_id', opts.appId);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('state', opts.state);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', META_SCOPES);
  return u.toString();
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params)}`);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(`graph ${path} failed (${res.status}): ${json.error?.message ?? 'unknown'}`);
  }
  return json;
}

/** code -> short-lived user token */
export async function metaExchangeCode(opts: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ access_token: string; expires_in?: number }> {
  return graph('oauth/access_token', {
    client_id: opts.appId,
    client_secret: opts.appSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
  });
}

/** short-lived -> long-lived (~60 days) user token */
export async function metaLongLived(opts: {
  appId: string;
  appSecret: string;
  shortToken: string;
}): Promise<{ access_token: string; expires_in: number }> {
  return graph('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: opts.appId,
    client_secret: opts.appSecret,
    fb_exchange_token: opts.shortToken,
  });
}

export interface MetaAsset {
  network: 'facebook' | 'instagram';
  external_id: string;
  handle: string;
  page_token: string;
  meta: Record<string, unknown>;
}

/** Enumerate the Pages the user granted, plus any linked IG business account. */
export async function metaListAssets(userToken: string): Promise<MetaAsset[]> {
  const res = await graph<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username: string };
    }>;
  }>('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: userToken,
  });

  const assets: MetaAsset[] = [];
  for (const page of res.data ?? []) {
    assets.push({
      network: 'facebook',
      external_id: page.id,
      handle: page.name,
      page_token: page.access_token,
      meta: { page_name: page.name },
    });
    if (page.instagram_business_account) {
      assets.push({
        network: 'instagram',
        external_id: page.instagram_business_account.id,
        handle: page.instagram_business_account.username,
        page_token: page.access_token, // IG content publishing uses the Page token
        meta: {
          ig_username: page.instagram_business_account.username,
          page_id: page.id,
          page_name: page.name,
        },
      });
    }
  }
  return assets;
}
