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
});
