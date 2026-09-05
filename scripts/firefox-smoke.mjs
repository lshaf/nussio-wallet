import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const TARGET = process.argv[2] === 'mv2' ? 'firefox-mv2' : 'firefox-mv3';
const SOURCE = path.resolve('dist', TARGET);
const BINARY = process.env.FIREFOX_PATH ?? '/Applications/Firefox.app/Contents/MacOS/firefox';
const UUID = '11111111-2222-3333-4444-555555555555';
const TIMEOUT_MS = 60_000;

const profile = mkdtempSync(path.join(tmpdir(), 'nussio-ff-'));
writeFileSync(
  path.join(profile, 'user.js'),
  [
    `user_pref("extensions.webextensions.uuids", "{\\"nussio-wallet@nussio.app\\":\\"${UUID}\\"}");`,
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  ].join('\n'),
);

const PAGE = `<!doctype html><meta charset=utf-8><title>probe</title>
<script>window.__early = !!window.__nussioLinkCapture;</script>
<body><a href="esr:gmNgZ">link</a>
<script>setTimeout(function(){
  fetch('/report?mainWorld=' + window.__early + '&inpage=' + !!window.nussio);
}, 3000);</script>`;

let settle;
const reported = new Promise((resolve) => {
  settle = resolve;
});

const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/report') settle(url.searchParams);
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(url.pathname === '/' ? PAGE : '');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const runner = spawn(
  'npx',
  [
    'web-ext',
    'run',
    '--source-dir',
    SOURCE,
    '--no-config-discovery',
    '--firefox',
    BINARY,
    '--no-reload',
    '--no-input',
    '--firefox-profile',
    profile,
    '--keep-profile-changes',
    '--start-url',
    `http://127.0.0.1:${port}/`,
  ],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);

let installed = false;
runner.stdout.on('data', (chunk) => {
  if (String(chunk).includes('as a temporary add-on')) installed = true;
});

const params = await Promise.race([
  reported,
  new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
]);

runner.kill();
server.close();
rmSync(profile, { recursive: true, force: true });

const checks = [
  ['extension installed', installed],
  ['page reported', params !== null],
  ['world: MAIN content script ran before page scripts', params?.get('mainWorld') === 'true'],
  ['inpage provider injected', params?.get('inpage') === 'true'],
];

let failed = false;
for (const [label, ok] of checks) {
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${TARGET}: ${label}`);
}
process.exit(failed ? 1 : 0);
