// A stable tint per campaign, keyed on its name — used by the avatar and the
// calendar so a campaign reads the same colour everywhere.

export const CAMPAIGN_TINTS = [
  { bg: '#e8e3d6', fg: '#636b2f' }, // olive
  { bg: '#f3ddd2', fg: '#ac4a2a' }, // brick
  { bg: '#e3e0d4', fg: '#373831' }, // ink
  { bg: '#f6dfd4', fg: '#b8461f' }, // coral-deep
  { bg: '#e6e6da', fg: '#5a6b3a' },
];

export function campaignTint(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return CAMPAIGN_TINTS[Math.abs(h) % CAMPAIGN_TINTS.length]!;
}
