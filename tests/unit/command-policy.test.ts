import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CommandPolicyError,
  createCommandPolicy,
  redactSensitive,
  validateCommand,
} from '../../src/adapters/command-runner.js';

const repositoryRoot = path.join(process.cwd(), 'fixtures', 'healthy');

describe('validateCommand', () => {
  it('allows a relative Node script without invoking a shell', () => {
    expect(
      validateCommand(
        'node scripts/install-check.mjs --mode "offline proof"',
        repositoryRoot,
        createCommandPolicy(),
      ),
    ).toEqual({
      args: ['scripts/install-check.mjs', '--mode', 'offline proof'],
      executable: 'node',
    });
  });

  it('allows npm ci only when lifecycle scripts are disabled', () => {
    expect(
      validateCommand('npm ci --ignore-scripts --offline', repositoryRoot, createCommandPolicy()),
    ).toMatchObject({
      args: ['ci', '--ignore-scripts', '--offline'],
      executable: 'npm',
    });

    expect(() => validateCommand('npm ci', repositoryRoot, createCommandPolicy())).toThrowError(
      CommandPolicyError,
    );
  });

  it.each([
    'node app.mjs && echo escaped',
    'node app.mjs | more',
    'node ../outside.mjs',
    'node -e "process.exit(0)"',
    'TOKEN=value node app.mjs',
    'curl https://example.test',
  ])('rejects unsafe or non-allowlisted command: %s', (command) => {
    expect(() => validateCommand(command, repositoryRoot, createCommandPolicy())).toThrowError(
      CommandPolicyError,
    );
  });

  it('requires an exact match for operator-added commands', () => {
    const policy = createCommandPolicy({ exactCommands: ['git status --short'] });

    expect(validateCommand('git status --short', repositoryRoot, policy)).toEqual({
      args: ['status', '--short'],
      executable: 'git',
    });
    expect(() => validateCommand('git status', repositoryRoot, policy)).toThrowError(
      CommandPolicyError,
    );
  });
});

describe('redactSensitive', () => {
  it('masks tokens, authorization headers, and credential assignments', () => {
    const assignment = `TOKEN=${['visible', 'secret'].join('-')}`;
    const githubToken = ['ghp', '123456789012345678901234567890123456'].join('_');
    const raw = `${assignment} Authorization: Bearer abc.def.ghi ${githubToken}`;

    expect(redactSensitive(raw)).toBe(
      'TOKEN=[REDACTED] Authorization: Bearer [REDACTED] [REDACTED]',
    );
  });
});
