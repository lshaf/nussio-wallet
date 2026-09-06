import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import path from 'node:path';
import crx3 from 'crx3';

const SOURCE = process.env.CRX_SOURCE ?? 'dist/chrome-mv3';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const output = process.env.CRX_OUT ?? `dist/nussio-wallet-${version}-chrome.crx`;
const keyPath = process.env.CRX_KEY_FILE;

function extensionId(pemPath) {
  const der = createPublicKey(readFileSync(pemPath, 'utf8')).export({
    type: 'spki',
    format: 'der',
  });
  return [...createHash('sha256').update(der).digest().subarray(0, 16)]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((nibble) => String.fromCharCode(97 + nibble))
    .join('');
}

if (!keyPath) {
  console.log('No CRX_KEY_FILE set, skipping the CRX package.');
  process.exit(0);
}

if (!existsSync(keyPath)) {
  throw new Error(`CRX_KEY_FILE not found: ${keyPath}`);
}

if (!existsSync(path.join(SOURCE, 'manifest.json'))) {
  throw new Error(`No manifest at ${SOURCE}/manifest.json. Run pnpm build first.`);
}

await crx3([path.join(SOURCE, 'manifest.json')], { keyPath, crxPath: output });
console.log(`${output}  ${(statSync(output).size / 1048576).toFixed(2)} MB`);
console.log(`extension id  ${extensionId(keyPath)}`);
