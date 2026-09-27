// Generates simple PNG app icons (no external deps).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const bg = [0x6d, 0x8a, 0x96], fg = [0xf6, 0xf4, 0xf0], dot = [0xe9, 0xb8, 0xa8];
  const rows = [];
  const s = size / 64;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const u = x / s, v = y / s;
      let c = bg;
      const dh = Math.hypot(u - 32, v - 17);
      if (Math.abs(dh - 7) < 1.6) c = fg;
      // shoulders arc + sides
      if (v >= 34 && v <= 52 && (Math.abs(u - 20) < 1.6 || Math.abs(u - 44) < 1.6)) c = fg;
      if (v < 34 && v > 24) {
        const d = Math.hypot((u - 32) / 12, (v - 34) / 9);
        if (Math.abs(d - 1) < 0.13) c = fg;
      }
      if (Math.hypot(u - 32, v - 36) < 4) c = dot;
      row[1 + x * 3] = c[0]; row[2 + x * 3] = c[1]; row[3 + x * 3] = c[2];
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, png(size));
