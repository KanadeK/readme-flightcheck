import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliEntry = path.join(repositoryRoot, 'dist', 'cli.js');
const iterations = 10;

async function runOnce() {
  const startedAt = process.hrtime.bigint();
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cliEntry, 'audit', 'fixtures/healthy', '--execute', '--format', 'json'],
      {
        cwd: repositoryRoot,
        shell: false,
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Healthy fixture exited with status ${code ?? 'unavailable'}.`));
      }
    });
  });
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

const measurements = [];
for (let index = 0; index < iterations; index += 1) {
  measurements.push(await runOnce());
}
const sorted = [...measurements].sort((left, right) => left - right);
const percentileIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
const result = {
  iterations,
  meanMs: Number((measurements.reduce((total, value) => total + value, 0) / iterations).toFixed(2)),
  p95Ms: Number((sorted[percentileIndex] ?? 0).toFixed(2)),
  samplesMs: measurements.map((value) => Number(value.toFixed(2))),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
