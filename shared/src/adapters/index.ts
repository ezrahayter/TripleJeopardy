import type { NetworkAdapter } from './types';
import { blueskyAdapter } from './bluesky';

const registry: Record<string, NetworkAdapter> = {
  [blueskyAdapter.network]: blueskyAdapter,
};

export function getAdapter(network: string): NetworkAdapter {
  const adapter = registry[network];
  if (!adapter) throw new Error(`No adapter registered for network "${network}"`);
  return adapter;
}

export function listNetworks(): string[] {
  return Object.keys(registry);
}

export * from './types';
export { blueskyAdapter };
