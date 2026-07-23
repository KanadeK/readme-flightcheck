import { spawnSync } from 'node:child_process';

const npmEntry = process.env.npm_execpath;
const tasks = ['format:check', 'lint', 'typecheck', 'test:unit'];

if (!npmEntry) {
  throw new Error('npm_execpath is unavailable; run this task through `npm run verify`.');
}

for (const task of tasks) {
  const result = spawnSync(process.execPath, [npmEntry, 'run', task], {
    cwd: process.cwd(),
    shell: false,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
