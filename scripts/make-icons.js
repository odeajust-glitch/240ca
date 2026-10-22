// Draws the line-up site's home-screen icon (owner, 2026-10-22): "240" in
// white on the site's teal, with a stretch of rail under it. Writes
// public/board-icon-192.png, board-icon-512.png and board-icon-180.png
// (iPhone). Run again only to change the icon: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BG = [0x0f, 0x5c, 0x63];
const FG = [0xff, 0xff, 0xff];

// 5×7 digits, one string per row.
const DIGITS = {
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};

function draw(size) {
  const px = Buffer.alloc(size * size * 3);
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < size && y < size) c.forEach((v, i) => { px[(y * size + x) * 3 + i] = v; }); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);
  const rect = (x0, y0, w, h, c) => { for (let y = Math.round(y0); y < Math.round(y0 + h); y++) for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(x, y, c); };
  // "240": 3 digits of 5 cells + 2 gaps = 17 cells across ~62% of the width.
  const cell = (size * 0.62) / 17;
  const left = (size - cell * 17) / 2;
  const th = Math.max(2, size * 0.022);
  // The number and the rail together, centred top to bottom.
  const top = (size - (7 * cell + size * 0.09 + th * 5.2)) / 2;
  [...'240'].forEach((d, n) => {
    DIGITS[d].forEach((row, ry) => [...row].forEach((on, rx) => {
      if (on === '1') rect(left + (n * 6 + rx) * cell, top + ry * cell, cell + 0.5, cell + 0.5, FG);
    }));
  });
  // Rail: two rails and ties under the number.
  const railTop = top + 7 * cell + size * 0.09;
  const rw = size * 0.66;
  const rx = (size - rw) / 2;
  for (let i = 0; i <= 6; i++) rect(rx + (i * (rw - th * 1.6)) / 6, railTop - th * 1.2, th * 1.6, th * 6.4, FG);
  rect(rx, railTop, rw, th, FG);
  rect(rx, railTop + th * 3, rw, th, FG);
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = draw(size);
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [192, 512, 180]) {
  const file = path.join(__dirname, '..', 'public', `board-icon-${size}.png`);
  fs.writeFileSync(file, png(size));
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}
