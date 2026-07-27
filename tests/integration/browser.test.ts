import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { captureSnapshot } from '../../src/adapters/browser.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createPage(markup: string): Promise<{ directory: string; url: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), 'flightcheck-browser-test-'));
  temporaryDirectories.push(directory);
  const filename = path.join(directory, 'page.html');
  await writeFile(filename, markup, 'utf8');
  return { directory, url: pathToFileURL(filename).href };
}

describe('captureSnapshot', () => {
  it('captures a deterministic page and accepts an identical baseline', async () => {
    const page = await createPage(
      '<!doctype html><html><body><main><h1>Flightcheck</h1><p>Stable proof.</p></main></body></html>',
    );
    const baselinePath = path.join(page.directory, 'baseline.png');
    const latestPath = path.join(page.directory, 'latest.png');

    const baseline = await captureSnapshot({ outputPath: baselinePath, url: page.url });
    const comparison = await captureSnapshot({
      baselinePath,
      outputPath: latestPath,
      url: page.url,
    });

    expect(baseline).toMatchObject({ diffPixels: 0, matches: true });
    expect(comparison).toMatchObject({
      baselinePath,
      diffPixels: 0,
      dimensionsMatch: true,
      matches: true,
    });
  });

  it('fails closed when snapshot dimensions change', async () => {
    const baselinePage = await createPage(
      '<!doctype html><html><body><h1>Short page</h1></body></html>',
    );
    const changedPage = await createPage(
      '<!doctype html><html><body><h1>Tall page</h1><div style="height:1800px"></div></body></html>',
    );
    const baselinePath = path.join(baselinePage.directory, 'baseline.png');
    await captureSnapshot({ outputPath: baselinePath, url: baselinePage.url });

    const result = await captureSnapshot({
      baselinePath,
      outputPath: path.join(changedPage.directory, 'latest.png'),
      url: changedPage.url,
    });

    expect(result).toMatchObject({
      diffRatio: 1,
      dimensionsMatch: false,
      matches: false,
    });
    expect(result.diffPixels).toBeGreaterThan(0);
  });

  it('rejects unsupported protocols and credential-bearing URLs', async () => {
    await expect(
      captureSnapshot({ outputPath: 'unused.png', url: 'ftp://example.test/page' }),
    ).rejects.toThrow('Unsupported snapshot protocol: ftp:');
    await expect(
      captureSnapshot({
        outputPath: 'unused.png',
        url: 'https://user:secret@example.test/page',
      }),
    ).rejects.toThrow('Snapshot URL must not contain credentials.');
  });
});
