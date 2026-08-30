/**
 * AES-256-GCM helpers for network credentials stored at rest.
 * Runs in browsers, Deno (Supabase Edge Functions) and Cloudflare Workers -
 * all provide Web Crypto, `atob` and `btoa` on the global scope.
 *
 * TJ_ENCRYPTION_KEY is a base64-encoded 32-byte key. Generate one with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * NOTE: mirrored in supabase/functions/_shared/crypto.ts because Supabase
 * bundles Edge Functions only from within supabase/functions/. Keep them in sync.
 */

function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBytes(keyB64), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Returns base64( iv[12] || ciphertext ). */
export async function encryptSecret(plaintext: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv);
  packed.set(ciphertext, iv.length);
  return bytesToB64(packed);
}

export async function decryptSecret(packedB64: string, keyB64: string): Promise<string> {
  const key = await importKey(keyB64);
  const packed = b64ToBytes(packedB64);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
