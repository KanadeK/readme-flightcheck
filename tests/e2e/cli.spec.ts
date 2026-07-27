import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runNode } from './helpers.js';

const repositoryRoot = process.cwd();
const cliEntry = path.join(repositoryRoot, 'dist', 'cli.js');
const fixtures = path.join(repositoryRoot, 'fixtures');
const temporaryDirectories: string[] = [];

test.afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('CLI rehearses every healthy README command and returns machine-readable proof', async () => {
  const result = await runNode(
    [cliEntry, 'audit', path.join(fixtures, 'healthy'), '--execute', '--format', 'json'],
    { cwd: repositoryRoot },
  );
  const report = JSON.parse(result.stdout) as {
    commandResults: { status: string }[];
    grade: string;
    passed: boolean;
    score: number;
  };

  expect(result.exitCode).toBe(0);
  expect(result.stderr).not.toContain('README Flightcheck failed:');
  expect(report).toMatchObject({ grade: 'A', passed: true, score: 100 });
  expect(report.commandResults).toHaveLength(4);
  expect(report.commandResults.every(({ status }) => status === 'passed')).toBe(true);
});

test('CLI exposes a stale install command as a real non-zero process result', async () => {
  const result = await runNode(
    [cliEntry, 'audit', path.join(fixtures, 'stale-command'), '--execute', '--format', 'json'],
    { cwd: repositoryRoot },
  );
  const report = JSON.parse(result.stdout) as {
    commandResults: { exitCode: number | null; section: string; status: string }[];
    grade: string;
    score: number;
  };

  expect(result.exitCode).toBe(1);
  expect(report).toMatchObject({ grade: 'C', score: 75 });
  expect(report.commandResults[0]).toMatchObject({
    exitCode: 1,
    section: 'install',
    status: 'failed',
  });
});

test('HTML report is accessible, responsive, and evidence-first', async ({ page }) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flightcheck-cli-e2e-'));
  temporaryDirectories.push(directory);
  const reportPath = path.join(directory, 'broken-links.html');
  const result = await runNode(
    [
      cliEntry,
      'audit',
      path.join(fixtures, 'broken-links'),
      '--execute',
      '--format',
      'html',
      '--output',
      reportPath,
    ],
    { cwd: repositoryRoot },
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Report written to');
  await page.goto(pathToFileURL(reportPath).href);
  await expect(page.getByRole('heading', { level: 1, name: 'README Flightcheck' })).toBeVisible();
  await expect(page.locator('.score')).toContainText('65');
  await expect(
    page.getByText('The local link target does not exist: docs/missing.md'),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.setViewportSize({ height: 844, width: 390 });
  const horizontalScrollAfterAttempt = await page.evaluate(() => {
    window.scrollTo({ left: 10_000 });
    return window.scrollX;
  });
  expect(horizontalScrollAfterAttempt).toBe(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to audit report' })).toBeFocused();
  await page.screenshot({ fullPage: true, path: path.join(directory, 'mobile-report.png') });

  expect(await readFile(reportPath, 'utf8')).toContain('README Flightcheck');
});

test('CLI returns an operational error for a missing repository', async () => {
  const result = await runNode(
    [cliEntry, 'audit', path.join(fixtures, 'does-not-exist'), '--format', 'json'],
    { cwd: repositoryRoot },
  );

  expect(result.exitCode).toBe(2);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('README Flightcheck failed:');
});
