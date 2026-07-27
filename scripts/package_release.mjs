import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = JSON.parse(
  await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
);
const { name, version } = packageManifest;
const releaseDirectory = path.join(repositoryRoot, 'dist-release');
const cacheDirectory = path.join(repositoryRoot, '.tmp', 'npm-cache');
const npmEntry = process.env.npm_execpath;

if (!npmEntry) {
  throw new Error('npm_execpath is unavailable; run this task through `npm run package`.');
}

function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: options.stdio ?? 'pipe',
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stderr, stdout });
      } else {
        reject(
          new Error(`${args.join(' ')} exited with status ${code ?? 'unavailable'}:\n${stderr}`),
        );
      }
    });
  });
}

async function archive(destination, entries) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(destination);
    const bundle = new ZipArchive({ zlib: { level: 9 } });
    output.once('close', resolve);
    output.once('error', reject);
    bundle.once('error', reject);
    bundle.pipe(output);
    for (const entry of entries) {
      if (entry.directory) {
        bundle.directory(entry.source, entry.destination);
      } else {
        bundle.file(entry.source, { name: entry.destination });
      }
    }
    void bundle.finalize();
  });
}

await rm(releaseDirectory, { force: true, recursive: true });
await mkdir(cacheDirectory, { recursive: true });
await cp(path.join(repositoryRoot, 'media'), path.join(releaseDirectory, 'media'), {
  recursive: true,
});
await cp(path.join(repositoryRoot, 'action-dist'), path.join(releaseDirectory, 'action-dist'), {
  recursive: true,
});

const npmEnvironment = { npm_config_cache: cacheDirectory };
const packed = await run([npmEntry, 'pack', '--json', '--pack-destination', releaseDirectory], {
  env: npmEnvironment,
});
const jsonStart = packed.stdout.lastIndexOf('\n[');
if (jsonStart < 0) {
  throw new Error(`npm pack did not emit JSON metadata:\n${packed.stdout}`);
}
const [npmAsset] = JSON.parse(packed.stdout.slice(jsonStart + 1));
if (!npmAsset?.filename) {
  throw new Error('npm pack did not report a release filename.');
}
const tarballPath = path.join(releaseDirectory, npmAsset.filename);
const actionZip = path.join(releaseDirectory, `${name}-v${version}-github-action.zip`);
const cliZip = path.join(releaseDirectory, `${name}-v${version}-cli.zip`);
const demoReport = path.join(releaseDirectory, `${name}-v${version}-demo-report.html`);

await archive(actionZip, [
  {
    destination: 'action-dist',
    directory: true,
    source: path.join(releaseDirectory, 'action-dist'),
  },
]);
await archive(cliZip, [
  { destination: 'dist', directory: true, source: path.join(repositoryRoot, 'dist') },
  { destination: 'LICENSE', source: path.join(repositoryRoot, 'LICENSE') },
  { destination: 'package.json', source: path.join(repositoryRoot, 'package.json') },
  { destination: 'README.md', source: path.join(repositoryRoot, 'README.md') },
]);
await cp(path.join(releaseDirectory, 'media', 'broken-links-report.html'), demoReport);
await rm(path.join(releaseDirectory, 'action-dist'), { force: true, recursive: true });
await rm(path.join(releaseDirectory, 'media'), { force: true, recursive: true });

const cleanDirectory = await mkdtemp(path.join(tmpdir(), 'flightcheck-package-smoke-'));
try {
  await run([npmEntry, 'install', '--ignore-scripts', '--prefer-offline', tarballPath], {
    cwd: cleanDirectory,
    env: npmEnvironment,
  });
  await run(
    [
      path.join(cleanDirectory, 'node_modules', name, 'dist', 'cli.js'),
      'audit',
      path.join(repositoryRoot, 'fixtures', 'healthy'),
      '--execute',
      '--format',
      'json',
    ],
    { cwd: cleanDirectory },
  );
} finally {
  await rm(cleanDirectory, { force: true, recursive: true });
}

const assets = (await readdir(releaseDirectory)).sort();
const checksums = await Promise.all(
  assets.map(async (asset) => {
    const content = await readFile(path.join(releaseDirectory, asset));
    return `${createHash('sha256').update(content).digest('hex')}  ${asset}`;
  }),
);
await writeFile(path.join(releaseDirectory, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8');
await Promise.all(
  [tarballPath, actionZip, cliZip, demoReport, path.join(releaseDirectory, 'SHA256SUMS.txt')].map(
    (asset) => access(asset),
  ),
);
process.stdout.write(`Release assets written to ${releaseDirectory}\n`);
