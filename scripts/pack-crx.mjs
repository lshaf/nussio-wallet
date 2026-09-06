import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crx3 from 'crx3';

const SOURCE = process.env.CRX_SOURCE ?? 'dist/chrome-mv3';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const output = process.env.CRX_OUT ?? `dist/nussio-wallet-${version}-chrome.crx`;

function resolveKey() {
  if (process.env.CRX_KEY_FILE) {
    if (!existsSync(process.env.CRX_KEY_FILE)) {
      throw new Error(`CRX_KEY_FILE not found: ${process.env.CRX_KEY_FILE}`);
    }
    return { keyPath: process.env.CRX_KEY_FILE, temporary: null };
  }
  const pem = (process.env.CRX_KEY ?? '').trim();
  if (!pem) return null;
  const dir = mkdtempSync(path.join(process.env.RUNNER_TEMP ?? tmpdir(), 'crx-'));
  chmodSync(dir, 0o700);
  const keyPath = path.join(dir, 'signing.pem');
  writeFileSync(keyPath, `${pem}\n`, { mode: 0o600 });
  return { keyPath, temporary: dir };
}

function extensionId(keyPath) {
  const der = createPublicKey(readFileSync(keyPath, 'utf8')).export({
    type: 'spki',
    format: 'der',
  });
  return [...createHash('sha256').update(der).digest().subarray(0, 16)]
    .flatMap((byte) => [byte >> 4, byte & 15])
    .map((nibble) => String.fromCharCode(97 + nibble))
    .join('');
}

const key = resolveKey();

if (!key) {
  console.log('No CRX_KEY or CRX_KEY_FILE set, skipping the CRX package.');
  process.exit(0);
}

if (!existsSync(path.join(SOURCE, 'manifest.json'))) {
  throw new Error(`No manifest at ${SOURCE}/manifest.json. Run pnpm build first.`);
}

try {
  await crx3([path.join(SOURCE, 'manifest.json')], { keyPath: key.keyPath, crxPath: output });
  console.log(`${output}  ${(statSync(output).size / 1048576).toFixed(2)} MB`);
  console.log(`extension id  ${extensionId(key.keyPath)}`);
} finally {
  if (key.temporary) rmSync(key.temporary, { recursive: true, force: true });
}
