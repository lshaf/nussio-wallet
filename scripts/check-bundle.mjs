import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist/chrome-mv3';
const TOTAL_BUDGET_MB = 2.8;
const ENTRY_BUDGET_KB = { 'popup.html': 600, 'app.html': 1300, 'prompt.html': 700 };
const FORBIDDEN_IN_POPUP = ['antelope', 'signing-request', 'resources'];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function chunkGraph(entry) {
  const seen = new Set();
  const queue = [...readFileSync(join(DIST, entry), 'utf8').matchAll(/chunks\/[\w.-]+\.js/g)].map(
    (match) => match[0],
  );
  while (queue.length > 0) {
    const chunk = queue.pop();
    if (!chunk || seen.has(chunk)) continue;
    seen.add(chunk);
    const source = readFileSync(join(DIST, chunk), 'utf8');
    for (const match of source.matchAll(/["'.]{1,2}\/?(chunks\/[\w.-]+\.js)/g))
      queue.push(match[1]);
  }
  return [...seen];
}

const failures = [];

const totalBytes = walk(DIST).reduce((sum, path) => sum + statSync(path).size, 0);
const totalMb = totalBytes / 1024 / 1024;
if (totalMb > TOTAL_BUDGET_MB) {
  failures.push(`total ${totalMb.toFixed(2)} MB over budget ${TOTAL_BUDGET_MB} MB`);
}

for (const [entry, budgetKb] of Object.entries(ENTRY_BUDGET_KB)) {
  const chunks = chunkGraph(entry);
  const bytes = chunks.reduce((sum, chunk) => sum + statSync(join(DIST, chunk)).size, 0);
  const kb = bytes / 1024;
  const label = `${entry} ${kb.toFixed(0)} KB across ${chunks.length} chunks`;
  if (kb > budgetKb) failures.push(`${label}, over budget ${budgetKb} KB`);
  else console.log(`ok  ${label}`);

  if (entry === 'popup.html') {
    const heavy = chunks.filter((chunk) =>
      FORBIDDEN_IN_POPUP.some((name) => chunk.toLowerCase().includes(name)),
    );
    if (heavy.length > 0) failures.push(`popup loads chain libraries: ${heavy.join(', ')}`);
  }
}

console.log(`ok  total ${totalMb.toFixed(2)} MB`);

if (failures.length > 0) {
  console.error(`\nbundle budget failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
