import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseReadme } from '../core/markdown.js';
import type { ReadmeDocument, RepositoryEntry, RepositorySnapshot } from '../core/types.js';

const ignoredDirectories = new Set([
  '.git',
  '.tmp',
  'coverage',
  'dist',
  'dist-release',
  'node_modules',
  'playwright-report',
  'test-results',
]);

export interface LoadRepositoryOptions {
  maxEntries?: number;
  maxMarkdownBytes?: number;
  readmePath?: string;
}

export interface LoadedRepository {
  document: ReadmeDocument;
  markdown: string;
  root: string;
  snapshot: RepositorySnapshot;
}

function repositoryPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function ensureContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the repository root: ${candidate}`);
  }
}

export async function loadRepository(
  rootPath: string,
  options: LoadRepositoryOptions = {},
): Promise<LoadedRepository> {
  const root = await realpath(path.resolve(rootPath));
  const readmePath = options.readmePath ?? 'README.md';
  const absoluteReadme = path.resolve(root, readmePath);
  ensureContained(root, absoluteReadme);

  const markdown = await readFile(absoluteReadme, 'utf8');
  const sourcePath = repositoryPath(path.relative(root, absoluteReadme));
  const maxEntries = options.maxEntries ?? 5000;
  const maxMarkdownBytes = options.maxMarkdownBytes ?? 1024 * 1024;
  const entries: Record<string, RepositoryEntry> = {};
  let entryCount = 0;

  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      if (ignoredDirectories.has(child.name)) {
        continue;
      }

      const absolute = path.join(directory, child.name);
      const relative = repositoryPath(path.relative(root, absolute));
      entryCount += 1;
      if (entryCount > maxEntries) {
        throw new Error(`Repository exceeds the ${maxEntries}-entry snapshot limit.`);
      }

      if (child.isSymbolicLink()) {
        continue;
      }
      if (child.isDirectory()) {
        entries[relative] = { kind: 'directory', size: 0 };
        await visit(absolute);
        continue;
      }
      if (!child.isFile()) {
        continue;
      }

      const stats = await lstat(absolute);
      const entry: RepositoryEntry = { kind: 'file', size: stats.size };
      if (/\.md$/iu.test(child.name) && stats.size <= maxMarkdownBytes) {
        entry.content = await readFile(absolute, 'utf8');
      }
      entries[relative] = entry;
    }
  }

  await visit(root);

  return {
    document: parseReadme(markdown, sourcePath),
    markdown,
    root,
    snapshot: { entries },
  };
}
