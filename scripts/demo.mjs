import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDirectory = path.join(repositoryRoot, 'media');
const siteDirectory = path.join(repositoryRoot, 'site');
const cliEntry = path.join(repositoryRoot, 'dist', 'cli.js');

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0 || code === 1) {
        resolve();
      } else {
        reject(new Error(`${args[0]} exited with status ${code ?? 'unavailable'}.`));
      }
    });
  });
}

await rm(mediaDirectory, { force: true, recursive: true });
await rm(siteDirectory, { force: true, recursive: true });
await mkdir(mediaDirectory, { recursive: true });
await mkdir(siteDirectory, { recursive: true });
await run([
  cliEntry,
  'audit',
  'fixtures/broken-links',
  '--execute',
  '--format',
  'html',
  '--output',
  path.join(mediaDirectory, 'broken-links-report.html'),
]);
await run([
  cliEntry,
  'audit',
  'fixtures/healthy',
  '--execute',
  '--format',
  'json',
  '--output',
  path.join(mediaDirectory, 'healthy-report.json'),
]);

const { captureSnapshot } = await import('../dist/adapters/browser.js');
await captureSnapshot({
  outputPath: path.join(mediaDirectory, 'demo.png'),
  timeoutMs: 30_000,
  url: pathToFileURL(path.join(mediaDirectory, 'broken-links-report.html')).href,
});
await copyFile(
  path.join(mediaDirectory, 'broken-links-report.html'),
  path.join(siteDirectory, 'index.html'),
);
