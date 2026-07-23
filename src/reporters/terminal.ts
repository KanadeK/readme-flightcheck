import colors from 'picocolors';
import type { AuditReport } from '../core/types.js';

export interface TerminalReporterOptions {
  color?: boolean;
}

export function reportAsTerminal(
  report: AuditReport,
  options: TerminalReporterOptions = {},
): string {
  const color = options.color ?? true;
  const paint = {
    dim: color ? colors.dim : (value: string) => value,
    error: color ? colors.red : (value: string) => value,
    heading: color ? colors.bold : (value: string) => value,
    notice: color ? colors.cyan : (value: string) => value,
    pass: color ? colors.green : (value: string) => value,
    warning: color ? colors.yellow : (value: string) => value,
  };
  const status = report.passed ? paint.pass('PASS') : paint.error('FAIL');
  const lines = [
    paint.heading('README Flightcheck'),
    `${paint.dim('Repository:')} ${report.repository}`,
    `${paint.dim('Source:')} ${report.source}`,
    `${paint.dim('Score:')} ${report.score} / ${report.grade}  ${status}`,
    `${paint.dim('Evidence:')} ${report.evidence.commandsExecuted}/${report.evidence.commandsDiscovered} commands, ${report.evidence.localReferencesChecked} local references, ${report.evidence.externalLinksChecked} external links, ${report.evidence.snapshotsCompared} snapshot comparisons`,
    '',
  ];

  if (report.findings.length === 0) {
    lines.push(paint.pass('No deductions.'));
  } else {
    lines.push(paint.heading('Deduction ledger'));
    for (const finding of report.findings) {
      const tone =
        finding.severity === 'error'
          ? paint.error
          : finding.severity === 'warning'
            ? paint.warning
            : paint.notice;
      const location = `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
      lines.push(
        tone(
          `  -${finding.deduction}  ${finding.code}  ${location}\n       ${finding.message}\n       Fix: ${finding.suggestion}`,
        ),
      );
    }
  }

  if (report.commandResults.length > 0) {
    lines.push('', paint.heading('Command rehearsal'));
    for (const result of report.commandResults) {
      const tone = result.status === 'passed' ? paint.pass : paint.error;
      lines.push(
        tone(
          `  ${result.status.padEnd(9)} ${result.section.padEnd(7)} line ${String(
            result.line,
          ).padStart(3)}  ${result.command}`,
        ),
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
