import { z } from 'zod';
import { captureSnapshot } from '../adapters/browser.js';
import {
  auditRepositoryBase,
  type AuditRepositoryBaseOptions,
  type AuditRepositoryResult,
} from './audit-base.js';

const SnapshotOptionsSchema = z
  .object({
    baselinePath: z.string().min(1).optional(),
    maxDiffRatio: z.number().min(0).max(1).default(0.005),
    pageUrl: z.string().url().optional(),
    snapshotOutput: z.string().min(1).optional(),
  })
  .refine((value) => !value.pageUrl || Boolean(value.snapshotOutput), {
    message: 'snapshotOutput is required when pageUrl is set.',
    path: ['snapshotOutput'],
  })
  .refine((value) => !value.baselinePath || Boolean(value.pageUrl), {
    message: 'pageUrl is required when baselinePath is set.',
    path: ['pageUrl'],
  });

export type AuditRepositoryOptions = AuditRepositoryBaseOptions &
  z.input<typeof SnapshotOptionsSchema>;

export async function auditRepository(
  rawOptions: AuditRepositoryOptions,
): Promise<AuditRepositoryResult> {
  const snapshotOptions = SnapshotOptionsSchema.parse(rawOptions);
  const snapshot =
    snapshotOptions.pageUrl && snapshotOptions.snapshotOutput
      ? await captureSnapshot({
          ...(snapshotOptions.baselinePath ? { baselinePath: snapshotOptions.baselinePath } : {}),
          maxDiffRatio: snapshotOptions.maxDiffRatio,
          outputPath: snapshotOptions.snapshotOutput,
          url: snapshotOptions.pageUrl,
        })
      : undefined;

  return auditRepositoryBase(rawOptions, snapshot);
}
