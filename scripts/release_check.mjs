import { execFileSync, spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmEntry = process.env.npm_execpath;
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const version = manifest.version;

if (!npmEntry) {
  throw new Error('npm_execpath is unavailable; run this task through `npm run release-check`.');
}

function runNpm(task) {
  const result = spawnSync(process.execPath, [npmEntry, 'run', task], {
    cwd: repositoryRoot,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const task of ['verify', 'test:coverage', 'test:e2e', 'build', 'security:scan']) {
  runNpm(task);
}

const changelog = await readFile(path.join(repositoryRoot, 'CHANGELOG.md'), 'utf8');
if (!changelog.includes(`## [${version}]`)) {
  throw new Error(`CHANGELOG.md does not contain a ${version} release heading.`);
}
const expectedAssets = [
  `${manifest.name}-${version}.tgz`,
  `${manifest.name}-v${version}-cli.zip`,
  `${manifest.name}-v${version}-demo-report.html`,
  `${manifest.name}-v${version}-github-action.zip`,
  'SHA256SUMS.txt',
];
for (const asset of expectedAssets) {
  await access(path.join(repositoryRoot, 'dist-release', asset));
}

const author = execFileSync('git', ['config', '--local', '--get', 'user.name'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
const email = execFileSync('git', ['config', '--local', '--get', 'user.email'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
if (!author || !/^[0-9]+\+[^@]+@users\.noreply\.github\.com$/u.test(email)) {
  throw new Error('Git author identity is not a GitHub noreply identity.');
}

const markerSearch = spawnSync(
  'git',
  [
    'grep',
    '-nE',
    'TODO|FIXME|NotImplemented|placeholder|coming soon|lorem ipsum',
    '--',
    ':!action-dist/**',
    ':!.github/ISSUE_TEMPLATE/**',
    ':!docs/ROADMAP.md',
    ':!scripts/release_check.mjs',
  ],
  { cwd: repositoryRoot, encoding: 'utf8' },
);
if (markerSearch.error || ![0, 1].includes(markerSearch.status)) {
  throw markerSearch.error ?? new Error(`git grep failed with ${markerSearch.status}`);
}
const markers = markerSearch.stdout.trim();
if (markers) {
  throw new Error(`Release-blocking placeholder marker found:\n${markers}`);
}

const status = execFileSync('git', ['status', '--short'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();
if (status) {
  throw new Error(`Worktree is not clean:\n${status}`);
}

process.stdout.write(
  `Release check passed for ${manifest.name} v${version} as ${author} <${email}>.\n`,
);
