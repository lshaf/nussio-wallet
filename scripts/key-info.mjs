import { createInterface } from 'node:readline';
import { PrivateKey, PublicKey } from '@wharfkit/antelope';

const args = process.argv.slice(2);
const showPrivate = args.includes('--private');
const prefix = (args.find((arg) => arg.startsWith('--prefix='))?.slice(9) ?? 'EOS').toUpperCase();

function legacyOrEmpty(publicKey) {
  try {
    return publicKey.toLegacyString(prefix);
  } catch {
    return '';
  }
}

function inspect(input) {
  try {
    const privateKey = PrivateKey.from(input);
    const publicKey = privateKey.toPublic();
    return {
      kind: 'private',
      curve: String(privateKey.type),
      wif: privateKey.toWif(),
      pvt: String(privateKey),
      publicKey: String(publicKey),
      legacy: legacyOrEmpty(publicKey),
    };
  } catch {
    /* not a private key */
  }
  try {
    const publicKey = PublicKey.from(input);
    return {
      kind: 'public',
      curve: String(publicKey.type),
      publicKey: String(publicKey),
      legacy: legacyOrEmpty(publicKey),
    };
  } catch (error) {
    return { kind: 'invalid', reason: error.message };
  }
}

function report(index, input) {
  const key = inspect(input);
  console.log(`\n[${index}] input ${input.slice(0, 4)}…${input.slice(-4)} (${input.length} chars)`);
  if (key.kind === 'invalid') {
    console.log(`     INVALID: ${key.reason}`);
    return key;
  }
  console.log(`     kind        ${key.kind}`);
  console.log(`     curve       ${key.curve}`);
  if (key.kind === 'private' && showPrivate) {
    console.log(`     wif         ${key.wif}`);
    console.log(`     modern pvt  ${key.pvt}`);
  }
  console.log(`     public      ${key.publicKey}`);
  if (key.legacy) console.log(`     legacy      ${key.legacy}`);
  return key;
}

if (process.stdin.isTTY) {
  console.error('Enter a key and press Enter for its result. Ctrl-C to quit.');
  console.error(
    `Mode: ${showPrivate ? 'private material SHOWN' : 'public data only'}, prefix ${prefix}`,
  );
}

const results = [];
const rl = createInterface({ input: process.stdin, terminal: false });
for await (const line of rl) {
  const value = line.trim();
  if (value.length === 0) continue;
  const key = report(results.length + 1, value);
  results.push(key);
  if (key.kind === 'invalid') continue;

  const first = results.find((candidate) => candidate.kind !== 'invalid');
  if (first !== key) {
    const same = first.publicKey === key.publicKey;
    console.log(`     => ${same ? 'SAME' : 'DIFFERENT'} vs key [1] (compared by public key)`);
  }
}

if (results.length === 0) {
  console.error('usage: node scripts/key-info.mjs [--private] [--prefix=WAX]');
  console.error('       one key per line on stdin, keeps keys out of shell history');
  process.exit(1);
}
