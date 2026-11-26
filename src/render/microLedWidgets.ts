// Pure TypeScript zero-dependency 8-bit grayscale PNG renderer for Even G2 micro-LED widgets.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  out.set(u32be(data.length), 0);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  out.set(u32be(crc), 8 + data.length);
  return out;
}

function zlibStore(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const blocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let dst = 2;
  let src = 0;
  while (src < raw.length || dst === 2) {
    const len = Math.min(maxBlock, raw.length - src);
    const isLast = src + len >= raw.length ? 1 : 0;
    out[dst++] = isLast;
    out[dst++] = len & 0xff;
    out[dst++] = (len >>> 8) & 0xff;
    const nlen = (~len) & 0xffff;
    out[dst++] = nlen & 0xff;
    out[dst++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(src, src + len), dst);
    dst += len;
    src += len;
  }
  out.set(u32be(adler32(raw)), dst);
  return out;
}

export function encodeGray8ToPng(width: number, height: number, pixels: Uint8Array): Uint8Array {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0;
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  ihdr.set(u32be(width), 0);
  ihdr.set(u32be(height), 4);
  ihdr[8] = 8;
  ihdr[9] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = makeChunk('IHDR', ihdr);
  const cIdat = makeChunk('IDAT', zlibStore(raw));
  const cIend = makeChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  let o = 0;
  png.set(sig, o); o += sig.length;
  png.set(cIhdr, o); o += cIhdr.length;
  png.set(cIdat, o); o += cIdat.length;
  png.set(cIend, o);
  return png;
}

class GraySurface {
  readonly width: number;
  readonly height: number;
  readonly buf: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buf = new Uint8Array(width * height);
  }

  px(x: number, y: number, val: number): void {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    const idx = iy * this.width + ix;
    if (val > this.buf[idx]) this.buf[idx] = val;
  }

  rect(x: number, y: number, w: number, h: number, val: number): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.width, Math.ceil(x + w));
    const y1 = Math.min(this.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy += 1) {
      for (let xx = x0; xx < x1; xx += 1) this.px(xx, yy, val);
    }
  }

  strokeRect(x: number, y: number, w: number, h: number, val: number): void {
    for (let xx = x; xx < x + w; xx += 1) {
      this.px(xx, y, val);
      this.px(xx, y + h - 1, val);
    }
    for (let yy = y; yy < y + h; yy += 1) {
      this.px(x, yy, val);
      this.px(x + w - 1, yy, val);
    }
  }

  arcRing(cx: number, cy: number, rOuter: number, rInner: number, ratio: number, bright: number, dim: number): void {
    const clamped = Math.max(0, Math.min(1, ratio));
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + clamped * Math.PI * 2;
    for (let y = Math.floor(cy - rOuter - 1); y <= Math.ceil(cy + rOuter + 1); y += 1) {
      for (let x = Math.floor(cx - rOuter - 1); x <= Math.ceil(cx + rOuter + 1); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist <= rOuter && dist >= rInner) {
          let ang = Math.atan2(dy, dx);
          if (ang < startAngle) ang += Math.PI * 2;
          const active = clamped >= 0.999 || ang <= endAngle;
          this.px(x, y, active ? bright : dim);
        }
      }
    }
  }

  toPng(): Uint8Array {
    return encodeGray8ToPng(this.width, this.height, this.buf);
  }
}

/**
 * Renders the Executive Triage Micro-LED Gauge (266x86):
 * Left: Circular Focus/Inbox-Zero progress ring
 * Right: Segmented source bars (Calendar / Gmail / Notion) + 30s Sprint bar
 */
export function renderTriageGaugePng(params: {
  width: number;
  height: number;
  clearRatio: number;
  calCount: number;
  mailCount: number;
  notionCount: number;
  totalItems: number;
}): Uint8Array {
  const { width, height, clearRatio, calCount, mailCount, notionCount, totalItems } = params;
  const s = new GraySurface(width, height);
  s.strokeRect(0, 0, width, height, 68);

  // Left circular Inbox-Zero ring
  const cx = 46;
  const cy = Math.floor(height / 2);
  s.arcRing(cx, cy, 30, 21, clearRatio, 248, 56);
  // Center checkmark or pulse dot
  if (clearRatio >= 0.99) {
    for (let i = 0; i < 8; i += 1) s.rect(cx - 8 + i, cy + i - 2, 2, 2, 255);
    for (let i = 0; i < 14; i += 1) s.rect(cx + i, cy + 5 - i, 2, 2, 255);
  } else {
    s.rect(cx - 4, cy - 4, 8, 8, 220);
  }

  // Right 3 source workload bars (Calendar, Gmail, Notion)
  const bx = 92;
  const bw = width - bx - 12;
  const denom = Math.max(3, totalItems);
  const rows = [
    { y: 14, count: calCount, lum: 245 },
    { y: 36, count: mailCount, lum: 210 },
    { y: 58, count: notionCount, lum: 175 },
  ];
  for (const row of rows) {
    s.strokeRect(bx, row.y, bw, 13, 85);
    const fillW = Math.round(((bw - 4) * Math.min(denom, row.count)) / denom);
    if (fillW > 0) {
      s.rect(bx + 2, row.y + 2, fillW, 9, row.lum);
    }
    // Tick notches
    for (let t = 1; t < 4; t += 1) {
      const tx = bx + Math.round((bw * t) / 4);
      s.rect(tx, row.y + 1, 1, 11, 32);
    }
  }

  return s.toPng();
}

export function renderVoiceWaveformPng(params: {
  width: number;
  height: number;
  levels: number[];
  active: boolean;
}): Uint8Array {
  const { width, height, levels, active } = params;
  const s = new GraySurface(width, height);
  s.strokeRect(0, 0, width, height, active ? 185 : 74);

  const bars = 24;
  const gap = 3;
  const innerW = width - 16;
  const barW = Math.max(3, Math.floor((innerW - gap * (bars - 1)) / bars));
  const midY = Math.floor(height / 2);
  const maxHalf = Math.floor((height - 16) / 2);

  for (let i = 0; i < bars; i += 1) {
    const lvl = Math.max(0.06, Math.min(1, levels[i] ?? 0.1));
    const halfH = Math.max(2, Math.round(lvl * maxHalf));
    const x = 8 + i * (barW + gap);
    s.rect(x, midY - halfH, barW, halfH * 2, active ? 245 : 120);
  }
  return s.toPng();
}
