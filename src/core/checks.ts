import path from 'node:path';
import GithubSlugger from 'github-slugger';
import type {
  Finding,
  ReadmeDocument,
  ReferenceClaim,
  RepositoryEntry,
  RepositorySnapshot,
  SectionKind,
} from './types.js';

function finding(
  base: Omit<Finding, 'file'>,
  document: ReadmeDocument,
  reference?: ReferenceClaim,
): Finding {
  return {
    ...base,
    file: document.sourcePath,
    ...(reference ? { line: reference.line, target: reference.target } : {}),
  };
}

function hasCommand(document: ReadmeDocument, section: SectionKind): boolean {
  return document.commands.some((command) => command.section === section);
}

export function checkStructure(document: ReadmeDocument): Finding[] {
  const findings: Finding[] = [];

  if (!document.title) {
    findings.push(
      finding(
        {
          category: 'structure',
          code: 'title.missing',
          deduction: 10,
          message: 'The README has no level-one title.',
          severity: 'error',
          suggestion: 'Add one clear H1 project title.',
        },
        document,
      ),
    );
  }

  if (document.introduction.length < 40) {
    findings.push(
      finding(
        {
          category: 'structure',
          code: 'introduction.missing',
          deduction: 8,
          message: 'The first screen does not explain the project in a substantive introduction.',
          severity: 'warning',
          suggestion: 'Add a concise problem, audience, and outcome statement below the title.',
        },
        document,
      ),
    );
  }

  const commandExpectations: ReadonlyArray<[SectionKind, string, number, 'error' | 'warning']> = [
    ['install', 'installation', 12, 'error'],
    ['run', 'run or usage', 10, 'error'],
    ['test', 'test', 8, 'warning'],
    ['example', 'example', 6, 'warning'],
  ];

  for (const [section, label, deduction, severity] of commandExpectations) {
    if (!hasCommand(document, section)) {
      findings.push(
        finding(
          {
            category: 'structure',
            code: `command.${section}.missing`,
            deduction,
            message: `No ${label} command was found in a matching README section.`,
            severity,
            suggestion: `Add a fenced shell block under a clearly named ${label} section.`,
          },
          document,
        ),
      );
    }
  }

  if (!document.references.some((reference) => reference.kind === 'image')) {
    findings.push(
      finding(
        {
          category: 'structure',
          code: 'screenshot.missing',
          deduction: 10,
          message: 'The README contains no product screenshot or report image.',
          severity: 'warning',
          suggestion: 'Include an image generated from the current product output.',
        },
        document,
      ),
    );
  }

  if (!document.references.some((reference) => reference.kind === 'badge')) {
    findings.push(
      finding(
        {
          category: 'structure',
          code: 'badge.missing',
          deduction: 2,
          message: 'The first-screen evidence has no recognizable status badge.',
          severity: 'notice',
          suggestion: 'Add CI, license, or release status evidence.',
        },
        document,
      ),
    );
  }

  if (!/\bv?\d+\.\d+\.\d+\b/iu.test(document.raw)) {
    findings.push(
      finding(
        {
          category: 'structure',
          code: 'status.missing',
          deduction: 4,
          message: 'No semantic-version status was found.',
          severity: 'warning',
          suggestion: 'State the current released or pre-release version explicitly.',
        },
        document,
      ),
    );
  }

  if (!/\b(?:privacy|security|secret|credential)\b|隐私|安全/iu.test(document.raw)) {
    findings.push(
      finding(
        {
          category: 'security',
          code: 'security-boundary.missing',
          deduction: 8,
          message: 'The README does not explain a privacy or security boundary.',
          severity: 'warning',
          suggestion: 'State what data, network access, and command execution the tool uses.',
        },
        document,
      ),
    );
  }

  return findings;
}

function splitTarget(target: string): { anchor: string; pathname: string } {
  const hashIndex = target.indexOf('#');
  const rawPath = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
  const rawAnchor = hashIndex >= 0 ? target.slice(hashIndex + 1) : '';
  const queryIndex = rawPath.indexOf('?');
  return {
    anchor: decodeURIComponent(rawAnchor).toLowerCase(),
    pathname: decodeURIComponent(queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath),
  };
}

function resolveRepositoryPath(sourcePath: string, targetPath: string): string | null {
  const unixTarget = targetPath.replaceAll('\\', '/');
  const combined = unixTarget.startsWith('/')
    ? unixTarget.slice(1)
    : path.posix.join(path.posix.dirname(sourcePath), unixTarget);
  const normalized = path.posix.normalize(combined || sourcePath).replace(/\/+$/u, '');

  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    return null;
  }

  return normalized || '.';
}

function headingSlugs(entry: RepositoryEntry): Set<string> | null {
  if (entry.content === undefined) {
    return null;
  }

  const slugger = new GithubSlugger();
  const slugs = new Set<string>();
  for (const match of entry.content.matchAll(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/gmu)) {
    const text = match[2]?.trim();
    if (text) {
      slugs.add(slugger.slug(text));
    }
  }
  return slugs;
}

export function checkReferences(document: ReadmeDocument, snapshot: RepositorySnapshot): Finding[] {
  const findings: Finding[] = [];

  for (const reference of document.references) {
    if (reference.external) {
      continue;
    }

    let target: ReturnType<typeof splitTarget>;
    try {
      target = splitTarget(reference.target);
    } catch {
      findings.push(
        finding(
          {
            category: 'reference',
            code: 'reference.invalid',
            deduction: 8,
            message: 'The reference contains malformed URL encoding.',
            severity: 'error',
            suggestion: 'Percent-encode the target with valid UTF-8 bytes.',
          },
          document,
          reference,
        ),
      );
      continue;
    }

    const resolved = resolveRepositoryPath(document.sourcePath, target.pathname);
    if (!resolved) {
      findings.push(
        finding(
          {
            category: 'security',
            code: 'reference.outside-root',
            deduction: 12,
            message: 'The reference resolves outside the repository root.',
            severity: 'error',
            suggestion: 'Use a path contained by the repository.',
          },
          document,
          reference,
        ),
      );
      continue;
    }

    const sameDocument = resolved === document.sourcePath;
    const entry = sameDocument
      ? ({
          content: document.raw,
          kind: 'file',
          size: document.raw.length,
        } satisfies RepositoryEntry)
      : snapshot.entries[resolved];

    if (!entry) {
      findings.push(
        finding(
          {
            category: 'reference',
            code: 'reference.missing',
            deduction: reference.kind === 'image' ? 15 : 12,
            message: `The local ${reference.kind} target does not exist: ${resolved}.`,
            severity: 'error',
            suggestion: 'Add the target file or correct the relative path and filename casing.',
          },
          document,
          reference,
        ),
      );
      continue;
    }

    if ((reference.kind === 'image' || reference.kind === 'badge') && entry.size === 0) {
      findings.push(
        finding(
          {
            category: 'reference',
            code: 'image.empty',
            deduction: 10,
            message: `The image target is empty: ${resolved}.`,
            severity: 'error',
            suggestion: 'Regenerate the image from real product output.',
          },
          document,
          reference,
        ),
      );
      continue;
    }

    if (!target.anchor) {
      continue;
    }

    const slugs = headingSlugs(entry);
    if (slugs === null) {
      findings.push(
        finding(
          {
            category: 'reference',
            code: 'anchor.unverifiable',
            deduction: 2,
            message: `The target content was unavailable for anchor validation: ${resolved}.`,
            severity: 'notice',
            suggestion: 'Include Markdown content in the repository snapshot.',
          },
          document,
          reference,
        ),
      );
    } else if (!slugs.has(target.anchor)) {
      findings.push(
        finding(
          {
            category: 'reference',
            code: 'anchor.missing',
            deduction: 8,
            message: `The anchor #${target.anchor} does not exist in ${resolved}.`,
            severity: 'error',
            suggestion: 'Update the fragment to match the target heading slug.',
          },
          document,
          reference,
        ),
      );
    }
  }

  return findings;
}
