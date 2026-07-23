import { z } from 'zod';
import type { SnapshotResult } from '../adapters/browser.js';
import { createCommandPolicy, runCommandsInIsolation } from '../adapters/command-runner.js';
import { loadRepository } from '../adapters/filesystem.js';
import { HttpLinkChecker, type ExternalLinkResult } from '../adapters/http.js';
import { checkReferences, checkStructure } from '../core/checks.js';
import { createAuditReport } from '../core/scoring.js';
import type {
  AuditReport,
  CommandResult,
  Finding,
  ReadmeDocument,
  ReferenceClaim,
} from '../core/types.js';

const AuditRepositoryBaseOptionsSchema = z.object({
  allowPrivateHosts: z.boolean().default(false),
  checkExternal: z.boolean().default(false),
  commandTimeoutMs: z
    .number()
    .int()
    .min(50)
    .max(10 * 60_000)
    .default(30_000),
  exactCommands: z.array(z.string().min(1)).default([]),
  execute: z.boolean().default(false),
  failBelow: z.number().int().min(0).max(100).default(80),
  generatedAt: z.date().default(() => new Date()),
  readmePath: z.string().min(1).default('README.md'),
  root: z.string().min(1),
});

export type AuditRepositoryBaseOptions = z.input<typeof AuditRepositoryBaseOptionsSchema>;

export interface AuditRepositoryResult {
  externalResults: ExternalLinkResult[];
  report: AuditReport;
  snapshot?: SnapshotResult;
}

function commandFinding(result: CommandResult, source: string): Finding | null {
  if (result.status === 'passed') {
    return null;
  }

  const deduction =
    result.status === 'rejected'
      ? 18
      : result.status === 'timed-out'
        ? 20
        : result.section === 'install'
          ? 25
          : result.section === 'run'
            ? 20
            : result.section === 'test'
              ? 15
              : 10;
  const code =
    result.status === 'rejected'
      ? 'command.rejected'
      : result.status === 'timed-out'
        ? 'command.timed-out'
        : 'command.failed';
  const message =
    result.status === 'rejected'
      ? `Command was rejected by the execution policy: ${result.command}`
      : result.status === 'timed-out'
        ? `Command exceeded its execution timeout: ${result.command}`
        : `Command exited with status ${result.exitCode ?? 'unavailable'}: ${result.command}`;

  return {
    category: result.status === 'rejected' ? 'security' : 'execution',
    code,
    deduction,
    file: source,
    line: result.line,
    message,
    severity: 'error',
    suggestion:
      result.status === 'rejected'
        ? 'Use a default-safe command shape or approve the exact command after review.'
        : 'Run the command in a clean checkout, then repair the README claim or implementation.',
    target: result.command,
  };
}

function externalFinding(
  reference: ReferenceClaim,
  result: ExternalLinkResult,
  source: string,
): Finding | null {
  if (result.status === 'ok') {
    return null;
  }

  return {
    category: result.status === 'blocked' ? 'security' : 'network',
    code: result.status === 'blocked' ? 'external-link.blocked' : 'external-link.failed',
    deduction: 5,
    file: source,
    line: reference.line,
    message:
      result.status === 'blocked'
        ? `External link was blocked by the private-network policy: ${reference.target}`
        : `External link check failed${
            result.statusCode === null ? '' : ` with HTTP ${result.statusCode}`
          }: ${reference.target}`,
    severity: 'warning',
    suggestion:
      result.status === 'blocked'
        ? 'Keep private hosts disabled, or explicitly allow them only for a trusted local fixture.'
        : 'Repair the URL or document why the endpoint is intentionally unavailable.',
    target: reference.target,
  };
}

function snapshotFinding(snapshot: SnapshotResult, source: string): Finding | null {
  if (snapshot.matches) {
    return null;
  }
  return {
    category: 'snapshot',
    code: snapshot.dimensionsMatch ? 'snapshot.changed' : 'snapshot.dimensions-changed',
    deduction: 20,
    file: source,
    message: `Latest page snapshot differs from the baseline by ${(snapshot.diffRatio * 100).toFixed(2)}%.`,
    severity: 'error',
    suggestion:
      'Review the generated snapshot and update the baseline only for an intentional UI change.',
    target: snapshot.outputPath,
  };
}

function uniqueExternalReferences(document: ReadmeDocument): ReferenceClaim[] {
  const references = new Map<string, ReferenceClaim>();
  for (const reference of document.references) {
    if (
      reference.external &&
      /^https?:/iu.test(reference.target) &&
      !references.has(reference.target)
    ) {
      references.set(reference.target, reference);
    }
  }
  return [...references.values()];
}

export async function auditRepositoryBase(
  rawOptions: AuditRepositoryBaseOptions,
  snapshot?: SnapshotResult,
): Promise<AuditRepositoryResult> {
  const options = AuditRepositoryBaseOptionsSchema.parse(rawOptions);
  const loaded = await loadRepository(options.root, { readmePath: options.readmePath });
  const findings = [
    ...checkStructure(loaded.document),
    ...checkReferences(loaded.document, loaded.snapshot),
  ];
  let commandResults: CommandResult[] = [];

  if (options.execute) {
    const execution = await runCommandsInIsolation(
      loaded.root,
      loaded.document.commands,
      createCommandPolicy({
        exactCommands: options.exactCommands,
        timeoutMs: options.commandTimeoutMs,
      }),
    );
    commandResults = execution.results;
    for (const result of commandResults) {
      const nextFinding = commandFinding(result, loaded.document.sourcePath);
      if (nextFinding) {
        findings.push(nextFinding);
      }
    }
  }

  const externalReferences = options.checkExternal ? uniqueExternalReferences(loaded.document) : [];
  const externalResults: ExternalLinkResult[] = [];
  if (externalReferences.length > 0) {
    const checker = new HttpLinkChecker({ allowPrivateHosts: options.allowPrivateHosts });
    for (const reference of externalReferences) {
      const result = await checker.check(reference.target);
      externalResults.push(result);
      const nextFinding = externalFinding(reference, result, loaded.document.sourcePath);
      if (nextFinding) {
        findings.push(nextFinding);
      }
    }
  }

  if (snapshot) {
    const nextFinding = snapshotFinding(snapshot, loaded.document.sourcePath);
    if (nextFinding) {
      findings.push(nextFinding);
    }
  }

  const report = createAuditReport({
    commandResults,
    evidence: {
      commandsDiscovered: loaded.document.commands.length,
      commandsExecuted: commandResults.length,
      externalLinksChecked: externalResults.length,
      localReferencesChecked: loaded.document.references.filter((reference) => !reference.external)
        .length,
      snapshotsCompared: snapshot?.baselinePath ? 1 : 0,
    },
    findings,
    generatedAt: options.generatedAt,
    minimumScore: options.failBelow,
    repository: loaded.root,
    source: loaded.document.sourcePath,
  });

  return {
    externalResults,
    report,
    ...(snapshot ? { snapshot } : {}),
  };
}
