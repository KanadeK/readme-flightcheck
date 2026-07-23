import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function readText(relativePath: string): Promise<string> {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

describe('repository metadata', () => {
  it('keeps the public package identity and Node support explicit', async () => {
    const packageJson = JSON.parse(await readText('package.json')) as {
      name: string;
      version: string;
      license: string;
      engines: { node: string };
    };

    expect(packageJson).toMatchObject({
      name: 'readme-flightcheck',
      version: '0.1.0',
      license: 'MIT',
      engines: { node: '>=22 <25' },
    });
  });

  it('ships the governance and release documents required for a public repository', async () => {
    const requiredFiles = [
      'CHANGELOG.md',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
      'LICENSE',
      'README.md',
      'README.zh-CN.md',
      'SECURITY.md',
      'docs/ARCHITECTURE.md',
      'docs/COMPETITOR_SCAN.md',
      'docs/PRIVACY_AND_SECURITY.md',
      'docs/RELEASE_CHECKLIST.md',
    ];

    const contents = await Promise.all(requiredFiles.map(readText));
    expect(contents.every((content) => content.trim().length > 40)).toBe(true);
  });
});
