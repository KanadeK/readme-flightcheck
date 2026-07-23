import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCommandPolicy, runCommandsInIsolation } from '../../src/adapters/command-runner.js';
import { loadRepository } from '../../src/adapters/filesystem.js';
import { parseReadme } from '../../src/core/markdown.js';

const fixtureRoot = path.join(process.cwd(), 'fixtures');
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('filesystem adapter', () => {
  it('loads Markdown content and a bounded repository snapshot', async () => {
    const loaded = await loadRepository(path.join(fixtureRoot, 'healthy'));

    expect(loaded.document.sourcePath).toBe('README.md');
    expect(loaded.snapshot.entries['assets/report.svg']).toMatchObject({
      kind: 'file',
    });
    expect(loaded.snapshot.entries['docs/guide.md']?.content).toContain('## Usage');
    expect(
      Object.keys(loaded.snapshot.entries).some((entry) => entry.includes('node_modules')),
    ).toBe(false);
  });
});

describe('isolated command adapter', () => {
  it('runs every healthy README claim in a disposable copy', async () => {
    const loaded = await loadRepository(path.join(fixtureRoot, 'healthy'));
    const result = await runCommandsInIsolation(
      loaded.root,
      loaded.document.commands,
      createCommandPolicy(),
    );

    expect(result.results).toHaveLength(4);
    expect(result.results.every(({ status }) => status === 'passed')).toBe(true);
    await expect(
      readFile(path.join(loaded.root, '.flightcheck-installed'), 'utf8'),
    ).rejects.toThrow();
  });

  it('preserves the real non-zero exit from a stale install command', async () => {
    const loaded = await loadRepository(path.join(fixtureRoot, 'stale-command'));
    const result = await runCommandsInIsolation(
      loaded.root,
      loaded.document.commands,
      createCommandPolicy(),
    );

    expect(result.results[0]).toMatchObject({
      exitCode: 1,
      section: 'install',
      status: 'failed',
    });
  });

  it('times out a real process and redacts its output', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'flightcheck-adapter-test-'));
    temporaryDirectories.push(directory);
    const secretLine = `TOKEN=${['super', 'secret'].join('-')}`;
    await writeFile(
      path.join(directory, 'slow.mjs'),
      `console.log(${JSON.stringify(secretLine)}); setTimeout(() => {}, 10_000);\n`,
      'utf8',
    );
    const commands = parseReadme('## Example\n\n```sh\nnode slow.mjs\n```\n', 'README.md').commands;

    const result = await runCommandsInIsolation(
      directory,
      commands,
      createCommandPolicy({ timeoutMs: 1000 }),
    );

    expect(result.results).toEqual([
      expect.objectContaining({
        status: 'timed-out',
        stdout: 'TOKEN=[REDACTED]',
      }),
    ]);
  });
});
