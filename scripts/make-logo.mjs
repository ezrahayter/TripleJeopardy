// Generates a 1024x1024 PNG app icon with no dependencies.
// Positive Force palette: Bone ground, three bars (charcoal / coral / charcoal).
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const S = 1024;
const BONE = [0xf0, 0xed, 0xe8];
const INK = [0x37, 0x38, 0x31];
const CORAL = [0xe7, 0x74, 0x51];

// three vertical bars, centered
const barW = 150;
const gap = 84;
const totalW = barW * 3 + gap * 2;
const x0 = (S - totalW) / 2;
const y0 = 280;
const y1 = S - 280;
const bars = [
  { x: x0, color: INK },
  { x: x0 + barW + gap, color: CORAL },
  { x: x0 + (barW + gap) * 2, color: INK },
];

function pixel(x, y) {
  for (const b of bars) {
    if (x >= b.x && x < b.x + barW && y >= y0 && y < y1) return b.color;
  }
  return BONE;
}

// raw scanlines: filter byte 0 + RGB
const raw = Buffer.alloc(S * (1 + S * 3));
for (let y = 0; y < S; y++) {
  const rowStart = y * (1 + S * 3);
  raw[rowStart] = 0;
  for (let x = 0; x < S; x++) {
    const [r, g, bl] = pixel(x, y);
    const p = rowStart + 1 + x * 3;
    raw[p] = r;
    raw[p + 1] = g;
    raw[p + 2] = bl;
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = new URL('../assets/app-icon-1024.png', import.meta.url);
writeFileSync(out, png);
console.log('wrote', out.pathname, `(${(png.length / 1024).toFixed(0)} KB)`);
