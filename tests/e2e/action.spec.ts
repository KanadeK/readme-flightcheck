import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseActionOutput, runNode } from './helpers.js';

const repositoryRoot = process.cwd();
const actionEntry = path.join(repositoryRoot, 'action-dist', 'index.js');
const fixture = path.join(repositoryRoot, 'fixtures', 'healthy');
const temporaryDirectories: string[] = [];

test.afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

test('bundled GitHub Action emits annotations, outputs, summary, and JSON evidence', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flightcheck-action-e2e-'));
  temporaryDirectories.push(directory);
  const githubOutput = path.join(directory, 'github-output.txt');
  const stepSummary = path.join(directory, 'step-summary.md');
  const reportPath = path.join(directory, 'report.json');
  await Promise.all([writeFile(githubOutput, '', 'utf8'), writeFile(stepSummary, '', 'utf8')]);
  const result = await runNode([actionEntry], {
    cwd: repositoryRoot,
    env: {
      GITHUB_ACTIONS: 'true',
      GITHUB_OUTPUT: githubOutput,
      GITHUB_STEP_SUMMARY: stepSummary,
      'INPUT_CHECK-EXTERNAL': 'false',
      'INPUT_COMMAND-TIMEOUT-MS': '30000',
      INPUT_EXECUTE: 'true',
      'INPUT_FAIL-BELOW': '80',
      INPUT_PATH: fixture,
      INPUT_README: 'README.md',
      'INPUT_REPORT-PATH': reportPath,
    },
  });

  expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);

  const outputs = parseActionOutput(await readFile(githubOutput, 'utf8'));
  const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
    grade: string;
    passed: boolean;
    score: number;
  };
  const summary = await readFile(stepSummary, 'utf8');

  expect(outputs).toMatchObject({
    grade: 'A',
    passed: 'true',
    'report-path': path.resolve(reportPath),
    score: '100',
  });
  expect(report).toMatchObject({ grade: 'A', passed: true, score: 100 });
  expect(summary).toContain('# README Flightcheck');
  expect(summary).toContain('100 / A');
});
