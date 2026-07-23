import type { AuditReport } from '../core/types.js';

export function reportAsJson(report: AuditReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
