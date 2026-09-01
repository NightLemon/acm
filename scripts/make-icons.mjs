// Generate PWA icons without an image dependency: rasterize a simple glyph into
// an RGBA buffer and encode it as PNG via zlib (Node built-in).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/icons');
mkdirSync(OUT, { recursive: true });

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  // Each scanline is prefixed with a filter byte (0 = none).
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 5x7 bitmap font, enough for the glyph we draw.
const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
};

function draw(size, { maskable }) {
  const buf = Buffer.alloc(size * size * 4);
  const BG = [0x13, 0x19, 0x22];
  const ACCENT = [0x4c, 0x8d, 0xff];

  // Maskable icons get a full-bleed square; regular ones get a rounded square
  // inset so they look right un-masked.
  const inset = maskable ? 0 : Math.round(size * 0.06);
  const radius = maskable ? 0 : Math.round(size * 0.22);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let inside = x >= inset && x < size - inset && y >= inset && y < size - inset;
      if (inside && radius > 0) {
        const lo = inset + radius, hi = size - inset - radius;
        const cx = x < lo ? lo : x > hi ? hi : x;
        const cy = y < lo ? lo : y > hi ? hi : y;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) inside = false;
      }
      if (inside) { buf[i] = BG[0]; buf[i + 1] = BG[1]; buf[i + 2] = BG[2]; buf[i + 3] = 255; }
      else buf[i + 3] = 0;
    }
  }

  // Center "ACM" in accent blue. Maskable art must stay in the safe zone (inner 80%).
  const text = 'ACM';
  const safe = maskable ? 0.52 : 0.66;
  const cw = 5, ch = 7, gap = 1;
  const totalCols = text.length * cw + (text.length - 1) * gap;
  const px = Math.max(1, Math.floor((size * safe) / totalCols));
  const tw = totalCols * px, th = ch * px;
  const ox = Math.round((size - tw) / 2), oy = Math.round((size - th) / 2);

  text.split('').forEach((ch2, ci) => {
    const g = GLYPHS[ch2];
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '1') continue;
        const sx = ox + (ci * (cw + gap) + c) * px;
        const sy = oy + r * px;
        for (let dy = 0; dy < px; dy++) {
          for (let dx = 0; dx < px; dx++) {
            const X = sx + dx, Y = sy + dy;
            if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
            const i = (Y * size + X) * 4;
            buf[i] = ACCENT[0]; buf[i + 1] = ACCENT[1]; buf[i + 2] = ACCENT[2]; buf[i + 3] = 255;
          }
        }
      }
    }
  });

  return png(size, size, buf);
}

writeFileSync(join(OUT, 'icon-192.png'), draw(192, { maskable: false }));
writeFileSync(join(OUT, 'icon-512.png'), draw(512, { maskable: false }));
writeFileSync(join(OUT, 'icon-maskable-512.png'), draw(512, { maskable: true }));
console.log('✓ icons written to public/icons/');
