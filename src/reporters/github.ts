import type { AuditReport } from '../core/types.js';

function escapeData(value: string): string {
  return value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

export function reportAsGithubAnnotations(report: AuditReport): string {
  const lines: string[] = [];
  for (const finding of report.findings) {
    const level =
      finding.severity === 'error'
        ? 'error'
        : finding.severity === 'warning'
          ? 'warning'
          : 'notice';
    const properties = [
      `file=${escapeProperty(finding.file)}`,
      ...(finding.line ? [`line=${finding.line}`] : []),
      `title=${escapeProperty(finding.code)}`,
    ].join(',');
    lines.push(`::${level} ${properties}::${escapeData(finding.message)}`);
  }
  lines.push(
    `::notice title=README Flightcheck::${escapeData(
      `Score ${report.score}/100 (${report.grade}); ${report.summary.errors} error(s), ${report.summary.warnings} warning(s).`,
    )}`,
  );
  return `${lines.join('\n')}\n`;
}
