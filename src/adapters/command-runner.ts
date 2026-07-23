import { spawn } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CommandClaim, CommandResult } from '../core/types.js';

const defaultTimeoutMs = 30_000;
const defaultMaxOutputBytes = 64 * 1024;
const ignoredCopySegments = new Set([
  '.git',
  '.tmp',
  'coverage',
  'dist',
  'dist-release',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export interface CommandPolicy {
  exactCommands: ReadonlySet<string>;
  maxOutputBytes: number;
  timeoutMs: number;
}

export interface CommandPolicyOptions {
  exactCommands?: readonly string[];
  maxOutputBytes?: number;
  timeoutMs?: number;
}

export interface ValidatedCommand {
  args: string[];
  executable: string;
}

export interface IsolationResult {
  results: CommandResult[];
}

export class CommandPolicyError extends Error {
  override readonly name = 'CommandPolicyError';

  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function normalizedCommand(command: string): string {
  return command.trim().replace(/\s+/gu, ' ');
}

export function createCommandPolicy(options: CommandPolicyOptions = {}): CommandPolicy {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const maxOutputBytes = options.maxOutputBytes ?? defaultMaxOutputBytes;

  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 10 * 60_000) {
    throw new CommandPolicyError('Timeout must be between 50 ms and 10 minutes.', 'policy.timeout');
  }
  if (!Number.isInteger(maxOutputBytes) || maxOutputBytes < 1024 || maxOutputBytes > 1024 * 1024) {
    throw new CommandPolicyError(
      'Maximum output must be between 1 KiB and 1 MiB.',
      'policy.output-limit',
    );
  }

  return {
    exactCommands: new Set((options.exactCommands ?? []).map(normalizedCommand)),
    maxOutputBytes,
    timeoutMs,
  };
}

function tokenize(command: string): string[] {
  if (!command.trim()) {
    throw new CommandPolicyError('Command is empty.', 'command.empty');
  }
  if (/[\0\r\n;&|<>`]|\$\(/u.test(command)) {
    throw new CommandPolicyError(
      'Shell control operators, substitutions, redirects, and newlines are not allowed.',
      'command.shell-syntax',
    );
  }

  const tokens: string[] = [];
  let current = '';
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index] ?? '';

    if (quote) {
      if (character === quote) {
        quote = null;
      } else if (character === '\\' && quote === '"' && index + 1 < command.length) {
        index += 1;
        current += command[index] ?? '';
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/u.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else if (character === '\\' && index + 1 < command.length) {
      const following = command[index + 1] ?? '';
      if (/\s|["'\\]/u.test(following)) {
        index += 1;
        current += following;
      } else {
        current += character;
      }
    } else {
      current += character;
    }
  }

  if (quote) {
    throw new CommandPolicyError('Command contains an unterminated quote.', 'command.quote');
  }
  if (current) {
    tokens.push(current);
  }
  if (tokens.length === 0) {
    throw new CommandPolicyError('Command is empty.', 'command.empty');
  }

  return tokens;
}

function ensureRelativeNodeScript(script: string, repositoryRoot: string): void {
  if (script.startsWith('-')) {
    throw new CommandPolicyError(
      'Node evaluation and option-only commands are not allowed.',
      'command.node-eval',
    );
  }
  if (path.isAbsolute(script) || script.split(/[\\/]/u).includes('..')) {
    throw new CommandPolicyError(
      'Node scripts must be relative paths contained by the repository.',
      'command.node-path',
    );
  }
  if (!/\.(?:cjs|js|mjs)$/iu.test(script)) {
    throw new CommandPolicyError(
      'Node commands must name a .js, .mjs, or .cjs script.',
      'command.node-extension',
    );
  }

  const resolved = path.resolve(repositoryRoot, script);
  const relative = path.relative(path.resolve(repositoryRoot), resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new CommandPolicyError(
      'Node script resolves outside the repository.',
      'command.node-path',
    );
  }
}

function validateNpmArguments(args: readonly string[]): void {
  if (args[0] !== 'ci') {
    throw new CommandPolicyError(
      'Only npm ci is allowed by default; add other commands explicitly.',
      'command.npm-subcommand',
    );
  }

  const flags = args.slice(1);
  const allowedFlags = new Set(['--ignore-scripts', '--offline', '--no-audit', '--no-fund']);
  if (!flags.includes('--ignore-scripts') || flags.some((flag) => !allowedFlags.has(flag))) {
    throw new CommandPolicyError(
      'npm ci requires --ignore-scripts and accepts only offline/audit/fund safety flags.',
      'command.npm-flags',
    );
  }
}

export function validateCommand(
  command: string,
  repositoryRoot: string,
  policy: CommandPolicy,
): ValidatedCommand {
  const tokens = tokenize(command);
  const [executable = '', ...args] = tokens;

  if (/^[A-Za-z_][A-Za-z\d_]*=/u.test(executable)) {
    throw new CommandPolicyError(
      'Environment-variable assignment is not allowed in README commands.',
      'command.environment',
    );
  }

  if (policy.exactCommands.has(normalizedCommand(command))) {
    return { args, executable };
  }

  const executableName = path.basename(executable).toLowerCase();
  if (executableName === 'node' || executableName === 'node.exe') {
    const script = args[0];
    if (!script) {
      throw new CommandPolicyError('Node command has no script.', 'command.node-script');
    }
    ensureRelativeNodeScript(script, repositoryRoot);
    return { args, executable: 'node' };
  }

  if (executableName === 'npm' || executableName === 'npm.cmd') {
    validateNpmArguments(args);
    return { args, executable: 'npm' };
  }

  throw new CommandPolicyError(
    `Executable is not allowlisted: ${executable}.`,
    'command.executable',
  );
}

export function redactSensitive(value: string): string {
  return value
    .replace(/\bgh[pousr]_[A-Za-z\d_]{20,}\b/gu, '[REDACTED]')
    .replace(/\bAuthorization:\s*Bearer\s+\S+/giu, 'Authorization: Bearer [REDACTED]')
    .replace(
      /\b((?:API_?KEY|ACCESS_?TOKEN|AUTH_?TOKEN|PASSWORD|SECRET|TOKEN)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s]+)/giu,
      '$1[REDACTED]',
    )
    .replace(
      /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gu,
      '[REDACTED]',
    );
}

function sanitizedEnvironment(temporaryRoot: string): NodeJS.ProcessEnv {
  const keys = [
    'APPDATA',
    'COMSPEC',
    'LOCALAPPDATA',
    'PATH',
    'Path',
    'PATHEXT',
    'SYSTEMROOT',
    'SystemRoot',
    'WINDIR',
  ];
  const environment: NodeJS.ProcessEnv = {
    CI: 'true',
    NO_COLOR: '1',
    TEMP: temporaryRoot,
    TMP: temporaryRoot,
  };

  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      environment[key] = value;
    }
  }
  return environment;
}

function npmInvocation(args: readonly string[]): ValidatedCommand {
  if (process.platform !== 'win32') {
    return { args: [...args], executable: 'npm' };
  }

  const npmEntry =
    process.env.npm_execpath ??
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return {
    args: [npmEntry, ...args],
    executable: process.execPath,
  };
}

function spawnInvocation(command: ValidatedCommand): ValidatedCommand {
  if (command.executable === 'node') {
    return { args: command.args, executable: process.execPath };
  }
  if (command.executable === 'npm') {
    return npmInvocation(command.args);
  }
  return command;
}

function limitedOutput(value: string, maximumBytes: number): string {
  const bytes = Buffer.from(value);
  const output =
    bytes.byteLength > maximumBytes
      ? `${bytes.subarray(0, maximumBytes).toString('utf8')}\n[OUTPUT TRUNCATED]`
      : value;
  return redactSensitive(output).trim();
}

async function runValidatedCommand(
  claim: CommandClaim,
  command: ValidatedCommand,
  workingDirectory: string,
  policy: CommandPolicy,
): Promise<CommandResult> {
  const invocation = spawnInvocation(command);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let finished = false;
    const child = spawn(invocation.executable, invocation.args, {
      cwd: workingDirectory,
      env: sanitizedEnvironment(workingDirectory),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const complete = (
      status: CommandResult['status'],
      exitCode: number | null,
      error?: Error,
    ): void => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      if (error) {
        stderr = `${stderr}\n${error.message}`;
      }
      resolve({
        command: claim.command,
        durationMs: Math.max(0, Date.now() - startedAt),
        exitCode,
        line: claim.line,
        section: claim.section,
        status,
        stderr: limitedOutput(stderr, policy.maxOutputBytes),
        stdout: limitedOutput(stdout, policy.maxOutputBytes),
      });
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, policy.timeoutMs);

    child.once('error', (error) => {
      complete('failed', null, error);
    });
    child.once('close', (exitCode) => {
      complete(timedOut ? 'timed-out' : exitCode === 0 ? 'passed' : 'failed', exitCode);
    });
  });
}

async function copyRepository(sourceRoot: string): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'readme-flightcheck-'));
  const absoluteSource = path.resolve(sourceRoot);

  await cp(absoluteSource, temporaryRoot, {
    filter: (source) => {
      const relative = path.relative(absoluteSource, source);
      if (!relative) {
        return true;
      }
      return !relative.split(path.sep).some((segment) => ignoredCopySegments.has(segment));
    },
    recursive: true,
  });

  return temporaryRoot;
}

export async function runCommandsInIsolation(
  repositoryRoot: string,
  claims: readonly CommandClaim[],
  policy: CommandPolicy,
): Promise<IsolationResult> {
  const temporaryRoot = await copyRepository(repositoryRoot);
  const results: CommandResult[] = [];

  try {
    for (const claim of claims) {
      try {
        const command = validateCommand(claim.command, temporaryRoot, policy);
        results.push(await runValidatedCommand(claim, command, temporaryRoot, policy));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          command: claim.command,
          durationMs: 0,
          exitCode: null,
          line: claim.line,
          section: claim.section,
          status: 'rejected',
          stderr: redactSensitive(message),
          stdout: '',
        });
      }
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }

  return { results };
}
