import {
  AuditReportSchema,
  FindingSchema,
  type AuditReport,
  type AuditEvidence,
  type CommandResult,
  type Finding,
} from './types.js';

export interface Score {
  deductionTotal: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
}

export function scoreFindings(findings: readonly Finding[]): Score {
  const deductionTotal = findings.reduce((total, finding) => total + finding.deduction, 0);
  const score = Math.max(0, 100 - deductionTotal);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return { deductionTotal, grade, score };
}

const severityOrder: Readonly<Record<Finding['severity'], number>> = {
  error: 0,
  warning: 1,
  notice: 2,
};

function compareFindings(left: Finding, right: Finding): number {
  return (
    severityOrder[left.severity] - severityOrder[right.severity] ||
    left.file.localeCompare(right.file) ||
    (left.line ?? 0) - (right.line ?? 0) ||
    left.code.localeCompare(right.code)
  );
}

export interface CreateAuditReportInput {
  commandResults: CommandResult[];
  evidence?: Partial<AuditEvidence>;
  findings: Finding[];
  generatedAt: Date;
  minimumScore?: number;
  repository: string;
  source: string;
  toolVersion?: string;
}

export function createAuditReport(input: CreateAuditReportInput): AuditReport {
  const findings = input.findings.map((item) => FindingSchema.parse(item)).sort(compareFindings);
  const score = scoreFindings(findings);
  const summary = {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    notices: findings.filter((finding) => finding.severity === 'notice').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
  };
  const evidence: AuditEvidence = {
    commandsDiscovered: input.evidence?.commandsDiscovered ?? input.commandResults.length,
    commandsExecuted: input.evidence?.commandsExecuted ?? input.commandResults.length,
    externalLinksChecked: input.evidence?.externalLinksChecked ?? 0,
    localReferencesChecked: input.evidence?.localReferencesChecked ?? 0,
    snapshotsCompared: input.evidence?.snapshotsCompared ?? 0,
  };
  const minimumScore = input.minimumScore ?? 80;

  return AuditReportSchema.parse({
    commandResults: input.commandResults,
    ...score,
    evidence,
    findings,
    generatedAt: input.generatedAt.toISOString(),
    grade: score.grade,
    passed: summary.errors === 0 && score.score >= minimumScore,
    repository: input.repository,
    schemaVersion: '1',
    source: input.source,
    summary,
    toolVersion: input.toolVersion ?? '0.1.0',
  });
}
