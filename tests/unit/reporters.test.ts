import { describe, expect, it } from 'vitest';
import { createAuditReport } from '../../src/core/scoring.js';
import type { Finding } from '../../src/core/types.js';
import {
  reportAsGithubAnnotations,
  reportAsHtml,
  reportAsJson,
  reportAsMarkdown,
  reportAsTerminal,
} from '../../src/reporters/index.js';

const finding: Finding = {
  category: 'reference',
  code: 'reference.missing',
  deduction: 12,
  file: 'README.md',
  line: 7,
  message: 'Missing <script>alert("x")</script> & guide.',
  severity: 'error',
  suggestion: 'Restore `docs/guide.md`.',
  target: 'docs/guide.md',
};

const report = createAuditReport({
  commandResults: [],
  evidence: {
    commandsDiscovered: 1,
    commandsExecuted: 0,
    externalLinksChecked: 0,
    localReferencesChecked: 1,
    snapshotsCompared: 0,
  },
  findings: [finding],
  generatedAt: new Date('2026-07-23T00:00:00.000Z'),
  repository: 'fixtures/broken-links',
  source: 'README.md',
});

describe('reporters', () => {
  it('serializes the validated report as round-trippable JSON', () => {
    expect(JSON.parse(reportAsJson(report))).toEqual(report);
  });

  it('shows score, evidence, deductions, and remediation in Markdown and terminal output', () => {
    const markdown = reportAsMarkdown(report);
    const terminal = reportAsTerminal(report, { color: false });

    expect(markdown).toContain('88 / B');
    expect(markdown).toContain('reference.missing');
    expect(markdown).toContain('Restore `docs/guide.md`.');
    expect(terminal).toContain('Score: 88 / B');
    expect(terminal).toContain('-12');
  });

  it('escapes untrusted finding text in a complete, responsive HTML report', () => {
    const html = reportAsHtml(report);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain('id="main-content"');
  });

  it('escapes GitHub workflow command data and emits a summary notice', () => {
    const annotations = reportAsGithubAnnotations({
      ...report,
      findings: [{ ...finding, message: 'bad % value\nnext line' }],
    });

    expect(annotations).toContain(
      '::error file=README.md,line=7,title=reference.missing::bad %25 value%0Anext line',
    );
    expect(annotations).toContain('::notice title=README Flightcheck::Score 88/100');
  });

  it('renders successful reports and every annotation severity without color leakage', () => {
    const successful = createAuditReport({
      commandResults: [
        {
          command: 'node app.mjs',
          durationMs: 12,
          exitCode: 0,
          line: 5,
          section: 'run',
          status: 'passed',
          stderr: '',
          stdout: 'ok',
        },
      ],
      evidence: {
        commandsDiscovered: 1,
        commandsExecuted: 1,
        externalLinksChecked: 0,
        localReferencesChecked: 1,
        snapshotsCompared: 0,
      },
      findings: [],
      generatedAt: new Date('2026-07-27T00:00:00.000Z'),
      repository: 'fixtures/healthy',
      source: 'README.md',
    });
    const informational = {
      ...report,
      findings: [
        { ...finding, line: undefined, severity: 'warning' as const },
        { ...finding, code: 'reference.notice', severity: 'notice' as const },
      ],
    };

    expect(reportAsTerminal(successful, { color: false })).toContain('No deductions.');
    expect(reportAsTerminal(successful, { color: false })).toContain('passed    run');
    expect(reportAsMarkdown(successful)).toContain('No deductions.');
    expect(reportAsHtml(successful)).toContain('Every checked claim matched its evidence.');
    expect(reportAsHtml(successful)).toContain('command-passed');
    expect(reportAsGithubAnnotations(informational)).toContain('::warning ');
    expect(reportAsGithubAnnotations(informational)).toContain('::notice ');
  });

  it('keeps Markdown table cells safe when optional command data is absent', () => {
    const escaped = reportAsMarkdown({
      ...report,
      commandResults: [
        {
          command: 'node tool.mjs | cat\nsecond line',
          durationMs: 0,
          exitCode: null,
          line: 9,
          section: 'example',
          status: 'rejected',
          stderr: '',
          stdout: '',
        },
      ],
      findings: [
        {
          ...finding,
          message: 'first | second\nthird',
          suggestion: 'repair | now',
        },
      ],
    });

    expect(escaped).toContain('first \\| second third');
    expect(escaped).toContain('repair \\| now');
    expect(escaped).toContain('| example | 9 | rejected | \u2014 |');
  });
});
