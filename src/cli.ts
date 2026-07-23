#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, CommanderError, InvalidArgumentError } from 'commander';
import { auditRepository } from './application/audit.js';
import type { AuditReport } from './core/types.js';
import {
  reportAsGithubAnnotations,
  reportAsHtml,
  reportAsJson,
  reportAsMarkdown,
  reportAsTerminal,
} from './reporters/index.js';

type OutputFormat = 'github' | 'html' | 'json' | 'markdown' | 'terminal';

interface CliOptions {
  allowCommand: string[];
  allowPrivateHosts: boolean;
  baseline?: string;
  checkExternal: boolean;
  color: boolean;
  commandTimeout: number;
  execute: boolean;
  failBelow: number;
  format: OutputFormat;
  maxDiffRatio: number;
  output?: string;
  pageUrl?: string;
  readme: string;
  snapshotOutput?: string;
}

export interface CliIo {
  stderr: (value: string) => void;
  stdout: (value: string) => void;
}

function integerInRange(label: string, minimum: number, maximum: number) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new InvalidArgumentError(`${label} must be an integer from ${minimum} to ${maximum}.`);
    }
    return parsed;
  };
}

function ratio(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new InvalidArgumentError('Snapshot diff ratio must be between 0 and 1.');
  }
  return parsed;
}

function outputFormat(value: string): OutputFormat {
  const formats: OutputFormat[] = ['terminal', 'json', 'markdown', 'html', 'github'];
  if (!formats.includes(value as OutputFormat)) {
    throw new InvalidArgumentError(`Format must be one of: ${formats.join(', ')}.`);
  }
  return value as OutputFormat;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function render(report: AuditReport, format: OutputFormat, color: boolean): string {
  switch (format) {
    case 'github':
      return reportAsGithubAnnotations(report);
    case 'html':
      return reportAsHtml(report);
    case 'json':
      return reportAsJson(report);
    case 'markdown':
      return reportAsMarkdown(report);
    case 'terminal':
      return reportAsTerminal(report, { color });
  }
}

async function writeReport(destination: string, content: string): Promise<void> {
  const absolute = path.resolve(destination);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, 'utf8');
}

export function createCliProgram(io: CliIo): { program: Command; result: { exitCode: number } } {
  const result = { exitCode: 0 };
  const program = new Command()
    .name('readme-flightcheck')
    .description(
      'Rehearse README commands and verify links, screenshots, examples, and first-screen evidence.',
    )
    .version('0.1.0')
    .showHelpAfterError()
    .exitOverride()
    .configureOutput({
      writeErr: io.stderr,
      writeOut: io.stdout,
    });

  program
    .command('audit [repository]', { isDefault: true })
    .description('Audit a local repository (default: current directory).')
    .option('--readme <path>', 'README path relative to the repository', 'README.md')
    .option('--execute', 'rehearse allowlisted commands in a disposable copy', false)
    .option(
      '--allow-command <command>',
      'approve one additional exact command without a shell (repeatable)',
      collect,
      [],
    )
    .option(
      '--command-timeout <ms>',
      'per-command timeout in milliseconds',
      integerInRange('Command timeout', 50, 600_000),
      30_000,
    )
    .option('--check-external', 'check HTTP(S) links; sends each URL to its destination', false)
    .option(
      '--allow-private-hosts',
      'allow external checks against loopback/private hosts (trusted fixtures only)',
      false,
    )
    .option('--page-url <url>', 'capture a rendered page as screenshot evidence')
    .option('--snapshot-output <path>', 'path for the latest page screenshot')
    .option('--baseline <path>', 'PNG baseline to compare with the latest screenshot')
    .option('--max-diff-ratio <ratio>', 'maximum accepted pixel difference ratio', ratio, 0.005)
    .option(
      '--format <format>',
      'terminal, json, markdown, html, or github',
      outputFormat,
      'terminal',
    )
    .option('--output <path>', 'write the selected report instead of stdout')
    .option(
      '--fail-below <score>',
      'minimum score for success',
      integerInRange('Minimum score', 0, 100),
      80,
    )
    .option('--no-color', 'disable ANSI colors in terminal output')
    .action(async (repository: string | undefined, options: CliOptions) => {
      try {
        const audit = await auditRepository({
          allowPrivateHosts: options.allowPrivateHosts,
          ...(options.baseline ? { baselinePath: options.baseline } : {}),
          checkExternal: options.checkExternal,
          commandTimeoutMs: options.commandTimeout,
          exactCommands: options.allowCommand,
          execute: options.execute,
          failBelow: options.failBelow,
          maxDiffRatio: options.maxDiffRatio,
          ...(options.pageUrl ? { pageUrl: options.pageUrl } : {}),
          readmePath: options.readme,
          root: repository ?? '.',
          ...(options.snapshotOutput ? { snapshotOutput: options.snapshotOutput } : {}),
        });
        const content = render(audit.report, options.format, options.color);
        if (options.output) {
          await writeReport(options.output, content);
          io.stderr(`Report written to ${path.resolve(options.output)}\n`);
        } else {
          io.stdout(content);
        }
        result.exitCode = audit.report.passed ? 0 : 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        io.stderr(`README Flightcheck failed: ${message}\n`);
        result.exitCode = 2;
      }
    });

  return { program, result };
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const { program, result } = createCliProgram(io);
  try {
    await program.parseAsync([...argv], { from: 'node' });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
        return 0;
      }
      return error.exitCode || 2;
    }
    throw error;
  }
  return result.exitCode;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(path.resolve(entry)).href) {
  process.exitCode = await runCli(process.argv, {
    stderr: (value) => process.stderr.write(value),
    stdout: (value) => process.stdout.write(value),
  });
}
