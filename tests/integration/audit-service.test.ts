import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditRepository } from '../../src/application/audit.js';

const fixtures = path.join(process.cwd(), 'fixtures');

describe('auditRepository', () => {
  it.each([
    ['healthy', 100, true],
    ['stale-command', 75, false],
    ['broken-links', 65, false],
    ['hollow-readme', 32, false],
  ] as const)('produces the documented %s fixture score', async (name, expectedScore, passed) => {
    const result = await auditRepository({
      execute: true,
      generatedAt: new Date('2026-07-23T00:00:00.000Z'),
      root: path.join(fixtures, name),
    });

    expect(result.report.score).toBe(expectedScore);
    expect(result.report.passed).toBe(passed);
    expect(result.report.generatedAt).toBe('2026-07-23T00:00:00.000Z');
  });

  it('does not pretend to execute commands unless rehearsal is enabled', async () => {
    const result = await auditRepository({
      execute: false,
      generatedAt: new Date('2026-07-23T00:00:00.000Z'),
      root: path.join(fixtures, 'stale-command'),
    });

    expect(result.report.commandResults).toEqual([]);
    expect(result.report.evidence.commandsDiscovered).toBe(4);
    expect(result.report.evidence.commandsExecuted).toBe(0);
    expect(result.report.score).toBe(100);
  });
});
