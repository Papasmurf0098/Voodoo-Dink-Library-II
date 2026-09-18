import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = ['sw.js', ...readdirSync('js').filter((name) => name.endsWith('.js')).map((name) => `js/${name}`)];
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (check.status !== 0) process.exit(check.status || 1);
}
const tests = readdirSync('tests').filter((name) => name.endsWith('.test.mjs')).map((name) => `tests/${name}`);
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(result.status ?? 1);
