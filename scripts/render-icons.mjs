import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SOURCE = process.argv[2] ?? 'src/public/icon/icon.svg';
const OUT_DIR = process.argv[3] ?? path.dirname(SOURCE);
const SIZES = process.argv.slice(4).map(Number);
const sizes = SIZES.length > 0 ? SIZES : [16, 32, 48, 96, 128];

const svg = readFileSync(SOURCE, 'utf8');
const browser = await chromium.launch();

for (const size of sizes) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  const shot = await page.screenshot({ omitBackground: true });
  const target = path.join(OUT_DIR, `${size}.png`);
  writeFileSync(target, shot);
  console.log(`${target}  ${size}x${size}  ${shot.length} B`);
  await page.close();
}

await browser.close();
