import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';

// Generates a simple "N" icon SVG at the requested size.
// SVGs are accepted by the PWA manifest; replace with real PNGs before release if desired.
function makeIconSvg(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#111111"/>
  <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" rx="${size * 0.15}" fill="#6ee7b7"/>
  <text x="50%" y="58%" text-anchor="middle" font-family="-apple-system, sans-serif" font-weight="700" font-size="${size * 0.5}" fill="#111111">N</text>
</svg>`;
}

await mkdir('public', { recursive: true });
await writeFile('public/icon-192.svg', makeIconSvg(192));
await writeFile('public/icon-512.svg', makeIconSvg(512));
await writeFile('public/apple-touch-icon.svg', makeIconSvg(180));
console.log('Wrote icon SVGs to public/. Replace with PNGs before release.');
