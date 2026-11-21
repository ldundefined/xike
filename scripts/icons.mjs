import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const size = 256;
const crc32 = buffer => {
  let crc = -1;
  for (const value of buffer) { crc ^= value; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
};
const chunk = (tag, data) => {
  const type = Buffer.from(tag), len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([len, type, data, crc]);
};
const pixels = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  // Analytic leaf mark, antialiased with 4 samples per pixel.
  let coverage = 0;
  for (const dx of [.25, .75]) for (const dy of [.25, .75]) {
    const px = x + dx - 128, py = y + dy - 124;
    const u = (px - py) / Math.SQRT2, v = (px + py) / Math.SQRT2;
    const leaf = (u / 106) ** 2 + (v / 62) ** 2 < 1;
    const vein = u > -75 && u < 65 && Math.abs(v) < 6;
    if (leaf && !vein) coverage++;
  }
  const index = y * (size * 4 + 1) + 1 + x * 4;
  pixels[index] = 165; pixels[index + 1] = 215; pixels[index + 2] = 190; pixels[index + 3] = coverage * 255 / 4;
}
const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
mkdirSync('assets', { recursive: true }); writeFileSync('assets/icon.png', png);
const ico = Buffer.alloc(22); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18);
writeFileSync('assets/icon.ico', Buffer.concat([ico, png]));
