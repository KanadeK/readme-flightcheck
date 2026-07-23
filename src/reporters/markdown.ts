import type { AuditReport } from '../core/types.js';

function escapeTable(value: string): string {
  return value.replaceAll('|', '\\|').replace(/\r?\n/gu, ' ');
}

export function reportAsMarkdown(report: AuditReport): string {
  const status = report.passed ? 'PASS' : 'FAIL';
  const lines = [
    '# README Flightcheck report',
    '',
    `**${report.score} / ${report.grade} — ${status}**`,
    '',
    `- Repository: \`${report.repository}\``,
    `- Source: \`${report.source}\``,
    `- Generated: ${report.generatedAt}`,
    `- Commands: ${report.evidence.commandsExecuted}/${report.evidence.commandsDiscovered} executed`,
    `- Local references checked: ${report.evidence.localReferencesChecked}`,
    `- External links checked: ${report.evidence.externalLinksChecked}`,
    `- Snapshot comparisons: ${report.evidence.snapshotsCompared}`,
    '',
    '## Deduction ledger',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No deductions.');
  } else {
    lines.push(
      '| Severity | Code | Location | Deduction | Finding | Suggested repair |',
      '| --- | --- | --- | ---: | --- | --- |',
    );
    for (const finding of report.findings) {
      lines.push(
        `| ${finding.severity} | \`${escapeTable(finding.code)}\` | \`${escapeTable(
          `${finding.file}${finding.line ? `:${finding.line}` : ''}`,
        )}\` | -${finding.deduction} | ${escapeTable(finding.message)} | ${escapeTable(
          finding.suggestion,
        )} |`,
      );
    }
  }

  if (report.commandResults.length > 0) {
    lines.push(
      '',
      '## Command rehearsal',
      '',
      '| Section | Line | Status | Exit | Command |',
      '| --- | ---: | --- | ---: | --- |',
    );
    for (const result of report.commandResults) {
      lines.push(
        `| ${result.section} | ${result.line} | ${result.status} | ${
          result.exitCode ?? '—'
        } | \`${escapeTable(result.command)}\` |`,
      );
    }
  }

  lines.push('', `_Schema ${report.schemaVersion}; README Flightcheck ${report.toolVersion}_`, '');
  return lines.join('\n');
}
