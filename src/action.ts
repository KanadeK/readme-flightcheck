import * as core from '@actions/core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditRepositoryBase } from './application/audit-base.js';
import { reportAsJson, reportAsMarkdown } from './reporters/index.js';

function booleanInput(name: string): boolean {
  if (!core.getInput(name)) {
    return false;
  }
  return core.getBooleanInput(name, { required: false });
}

function numericInput(name: string, fallback: number): number {
  const value = core.getInput(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be numeric.`);
  }
  return parsed;
}

async function run(): Promise<void> {
  try {
    const outputPath = core.getInput('report-path') || 'readme-flightcheck-report.json';
    const result = await auditRepositoryBase({
      allowPrivateHosts: booleanInput('allow-private-hosts'),
      checkExternal: booleanInput('check-external'),
      commandTimeoutMs: numericInput('command-timeout-ms', 30_000),
      exactCommands: core.getMultilineInput('allow-command'),
      execute: booleanInput('execute'),
      failBelow: numericInput('fail-below', 80),
      readmePath: core.getInput('readme') || 'README.md',
      root: core.getInput('path') || '.',
    });

    for (const finding of result.report.findings) {
      const properties: core.AnnotationProperties = {
        file: finding.file,
        title: finding.code,
        ...(finding.line ? { endLine: finding.line, startLine: finding.line } : {}),
      };
      if (finding.severity === 'error') {
        core.error(finding.message, properties);
      } else if (finding.severity === 'warning') {
        core.warning(finding.message, properties);
      } else {
        core.notice(finding.message, properties);
      }
    }

    const absoluteOutput = path.resolve(outputPath);
    await mkdir(path.dirname(absoluteOutput), { recursive: true });
    await writeFile(absoluteOutput, reportAsJson(result.report), 'utf8');
    await core.summary.addRaw(reportAsMarkdown(result.report)).write();

    core.setOutput('score', result.report.score);
    core.setOutput('grade', result.report.grade);
    core.setOutput('passed', result.report.passed);
    core.setOutput('report-path', absoluteOutput);

    if (!result.report.passed) {
      core.setFailed(
        `README Flightcheck scored ${result.report.score}/100 (${result.report.grade}) with ${result.report.summary.errors} error(s).`,
      );
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

await run();
