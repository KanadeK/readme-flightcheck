import { spawn } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const typescriptEntry = path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const nccEntry = path.join(
  repositoryRoot,
  'node_modules',
  '@vercel',
  'ncc',
  'dist',
  'ncc',
  'cli.js',
);
const actionDirectory = path.join(repositoryRoot, 'action-dist');

async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${args[0]} exited with status ${code ?? 'unavailable'}.`));
      }
    });
  });
}

await rm(path.join(repositoryRoot, 'dist'), { force: true, recursive: true });
await rm(actionDirectory, { force: true, recursive: true });
await mkdir(actionDirectory, { recursive: true });
await run([typescriptEntry, '--project', 'tsconfig.build.json']);
await run([
  nccEntry,
  'build',
  'src/action.ts',
  '--out',
  'action-dist',
  '--minify',
  '--no-cache',
  '--license',
  'THIRD_PARTY_LICENSES.txt',
  '--target',
  'es2023',
]);
await access(path.join(actionDirectory, 'index.js'));
await rm(path.join(actionDirectory, 'src'), { force: true, recursive: true });
await rm(path.join(actionDirectory, 'tests'), { force: true, recursive: true });
await rm(path.join(actionDirectory, 'vitest.config.d.ts'), { force: true });
await rm(path.join(actionDirectory, 'vitest.config.d.ts.map'), { force: true });
