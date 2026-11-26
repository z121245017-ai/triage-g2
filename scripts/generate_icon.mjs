#!/usr/bin/env node
/**
 * Generates an EvenHub-compliant 24x24 PNG icon:
 * 2x2 raster-aligned opaque #F4F4F4 blocks on transparent background.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// 12x12 Inbox-Zero check / AI focus ring icon
const GRID = [
  '............',
  '...######...',
  '..#......#..',
  '.#........#.',
  '.#......#.#.',
  '.#.....#..#.',
  '.#..#.#...#.',
  '.#...#....#.',
  '.#........#.',
  '..#......#..',
  '...######...',
  '............',
];

const W = 24;
const H = 24;
const rgba = Buffer.alloc(W * H * 4);

for (let my = 0; my < 12; my += 1) {
  for (let mx = 0; mx < 12; mx += 1) {
    if (GRID[my][mx] !== '#') continue;
    for (let dy = 0; dy < 2; dy += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const idx = ((my * 2 + dy) * W + (mx * 2 + dx)) * 4;
        rgba[idx] = 0xf4;
        rgba[idx + 1] = 0xf4;
        rgba[idx + 2] = 0xf4;
        rgba[idx + 3] = 0xff;
      }
    }
  }
}

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y += 1) {
  raw[y * (W * 4 + 1)] = 0;
  rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.resolve(process.cwd(), 'assets', 'icon-24x24.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log(`Generated compliant 24x24 icon (${png.length} bytes): ${outPath}`);
