import { z } from 'zod';

export const SectionKindSchema = z.enum(['install', 'run', 'test', 'example', 'other']);
export type SectionKind = z.infer<typeof SectionKindSchema>;

export const SeveritySchema = z.enum(['error', 'warning', 'notice']);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingCategorySchema = z.enum([
  'structure',
  'reference',
  'execution',
  'network',
  'snapshot',
  'security',
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

export interface HeadingClaim {
  depth: number;
  line: number;
  slug: string;
  text: string;
}

export interface CodeBlockClaim {
  language: string;
  line: number;
  section: SectionKind;
  value: string;
}

export interface CommandClaim {
  command: string;
  language: string;
  line: number;
  section: SectionKind;
}

export type ReferenceKind = 'link' | 'image' | 'badge';

export interface ReferenceClaim {
  external: boolean;
  kind: ReferenceKind;
  line: number;
  target: string;
  text: string;
}

export interface ReadmeDocument {
  codeBlocks: CodeBlockClaim[];
  commands: CommandClaim[];
  headings: HeadingClaim[];
  introduction: string;
  raw: string;
  references: ReferenceClaim[];
  sourcePath: string;
  title: string | null;
}

export interface RepositoryEntry {
  content?: string;
  kind: 'file' | 'directory';
  size: number;
}

export interface RepositorySnapshot {
  entries: Readonly<Record<string, RepositoryEntry>>;
}

export const FindingSchema = z.object({
  category: FindingCategorySchema,
  code: z.string().min(1),
  deduction: z.number().int().nonnegative(),
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  message: z.string().min(1),
  severity: SeveritySchema,
  suggestion: z.string().min(1),
  target: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const CommandResultSchema = z.object({
  command: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  exitCode: z.number().int().nullable(),
  line: z.number().int().positive(),
  section: SectionKindSchema,
  status: z.enum(['passed', 'failed', 'rejected', 'timed-out']),
  stderr: z.string(),
  stdout: z.string(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

export const AuditEvidenceSchema = z.object({
  commandsDiscovered: z.number().int().nonnegative(),
  commandsExecuted: z.number().int().nonnegative(),
  externalLinksChecked: z.number().int().nonnegative(),
  localReferencesChecked: z.number().int().nonnegative(),
  snapshotsCompared: z.number().int().nonnegative(),
});
export type AuditEvidence = z.infer<typeof AuditEvidenceSchema>;

export const AuditReportSchema = z.object({
  commandResults: z.array(CommandResultSchema),
  deductionTotal: z.number().int().nonnegative(),
  evidence: AuditEvidenceSchema,
  findings: z.array(FindingSchema),
  generatedAt: z.string().datetime(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']),
  passed: z.boolean(),
  repository: z.string().min(1),
  schemaVersion: z.literal('1'),
  score: z.number().int().min(0).max(100),
  source: z.string().min(1),
  summary: z.object({
    errors: z.number().int().nonnegative(),
    notices: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
  }),
  toolVersion: z.string().min(1),
});
export type AuditReport = z.infer<typeof AuditReportSchema>;
