import type { NetworkAdapter } from './types';
import { blueskyAdapter } from './bluesky';
import { facebookAdapter } from './facebook';
import { instagramAdapter } from './instagram';
import { threadsAdapter } from './threads';

const adapters: NetworkAdapter[] = [
  blueskyAdapter,
  facebookAdapter,
  instagramAdapter,
  threadsAdapter,
];

const registry: Record<string, NetworkAdapter> = Object.fromEntries(
  adapters.map((a) => [a.network, a]),
);

export function getAdapter(network: string): NetworkAdapter {
  const adapter = registry[network];
  if (!adapter) throw new Error(`No adapter registered for network "${network}"`);
  return adapter;
}

export function listNetworks(): string[] {
  return Object.keys(registry);
}

export * from './types';
export { blueskyAdapter, facebookAdapter, instagramAdapter, threadsAdapter };
