import { describe, expect, it } from 'vitest';
import { createAuditReport, scoreFindings } from '../../src/core/scoring.js';
import type { Finding } from '../../src/core/types.js';

const commandFailure: Finding = {
  category: 'execution',
  code: 'command.failed',
  deduction: 25,
  file: 'README.md',
  line: 8,
  message: 'Install command exited with status 1.',
  severity: 'error',
  suggestion: 'Replace the stale command or repair the install path.',
};

const findings: Finding[] = [
  commandFailure,
  {
    category: 'structure',
    code: 'section.test.missing',
    deduction: 8,
    file: 'README.md',
    message: 'No test command was found.',
    severity: 'warning',
    suggestion: 'Document a reproducible test command.',
  },
];

describe('scoreFindings', () => {
  it('produces a transparent bounded score and stable grade', () => {
    expect(scoreFindings(findings)).toEqual({
      deductionTotal: 33,
      grade: 'D',
      score: 67,
    });
  });

  it('clamps excessive deductions at zero', () => {
    expect(
      scoreFindings([
        ...findings,
        { ...commandFailure, code: 'command.failed.again', deduction: 90 },
      ]),
    ).toMatchObject({
      deductionTotal: 123,
      grade: 'F',
      score: 0,
    });
  });
});

describe('createAuditReport', () => {
  it('uses an injected clock and deterministic finding order', () => {
    const report = createAuditReport({
      commandResults: [],
      findings: [...findings].reverse(),
      generatedAt: new Date('2026-07-23T00:00:00.000Z'),
      repository: 'fixtures/stale-command',
      source: 'README.md',
    });

    expect(report.generatedAt).toBe('2026-07-23T00:00:00.000Z');
    expect(report.findings.map(({ code }) => code)).toEqual([
      'command.failed',
      'section.test.missing',
    ]);
    expect(report.summary).toEqual({
      errors: 1,
      notices: 0,
      warnings: 1,
    });
    expect(report.passed).toBe(false);
    expect(report.score).toBe(67);
  });
});
