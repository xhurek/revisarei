import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve(process.cwd(), 'public/favicon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const sizes = [
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-icon-512x512.png', size: 512 }
];

async function generate() {
  for (const { name, size } of sizes) {
    const outPath = path.resolve(process.cwd(), 'public', name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${name} (${size}x${size})`);
  }
}

generate().catch(console.error);
