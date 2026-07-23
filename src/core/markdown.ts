import GithubSlugger from 'github-slugger';
import type { Code, Image, RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { Node } from 'unist';
import type {
  CodeBlockClaim,
  CommandClaim,
  ReadmeDocument,
  ReferenceClaim,
  SectionKind,
} from './types.js';

const shellLanguages = new Set([
  'bash',
  'cmd',
  'console',
  'powershell',
  'ps1',
  'sh',
  'shell',
  'terminal',
  'zsh',
]);

const sectionMatchers: ReadonlyArray<[SectionKind, RegExp]> = [
  ['install', /\b(?:install|installation|setup|prerequisites?)\b|安装|环境配置/iu],
  ['test', /\b(?:test|tests|testing|checks?)\b|测试|验证/iu],
  ['example', /\b(?:example|examples|demo)\b|示例|演示/iu],
  [
    'run',
    /\b(?:usage|run|running|start|quick\s*start|getting\s*started)\b|运行|用法|使用|快速开始/iu,
  ],
];

function classifySection(text: string): SectionKind {
  for (const [section, matcher] of sectionMatchers) {
    if (matcher.test(text)) {
      return section;
    }
  }

  return 'other';
}

function sourceLine(node: Node): number {
  return node.position?.start.line ?? 1;
}

function isExternalTarget(target: string): boolean {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target);
}

function isBadge(image: Image): boolean {
  return (
    /(?:shields\.io|badgen\.net|badge)/iu.test(image.url) ||
    /^(?:build|ci|coverage|license|release|status)(?:\s|$)/iu.test(image.alt ?? '')
  );
}

function collectReferences(node: RootContent, references: ReferenceClaim[]): void {
  if (node.type === 'link') {
    references.push({
      external: isExternalTarget(node.url),
      kind: 'link',
      line: sourceLine(node),
      target: node.url,
      text: toString(node),
    });
  }

  if (node.type === 'image') {
    references.push({
      external: isExternalTarget(node.url),
      kind: isBadge(node) ? 'badge' : 'image',
      line: sourceLine(node),
      target: node.url,
      text: node.alt ?? '',
    });
  }

  if ('children' in node) {
    for (const child of node.children) {
      collectReferences(child, references);
    }
  }
}

function stripPrompt(line: string): string {
  return line
    .replace(/^\s*(?:\$\s+|PS>\s+|>\s+)/u, '')
    .replace(/^\s*[A-Za-z]:\\[^>]*>\s*/u, '')
    .trim();
}

function extractCommands(code: Code, section: SectionKind): CommandClaim[] {
  const language = (code.lang ?? '').toLowerCase();
  if (!shellLanguages.has(language)) {
    return [];
  }

  const commands: CommandClaim[] = [];
  const lines = code.value.split(/\r?\n/u);
  let pending = '';
  let pendingLine = 0;

  for (const [index, source] of lines.entries()) {
    const lineNumber = sourceLine(code) + index + 1;
    const stripped = stripPrompt(source);

    if (!pending && (!stripped || stripped.startsWith('#'))) {
      continue;
    }

    const continued = /(?:\\|`)\s*$/u.test(stripped);
    const part = continued ? stripped.replace(/(?:\\|`)\s*$/u, '').trim() : stripped;

    if (!pending) {
      pendingLine = lineNumber;
    }
    pending = `${pending} ${part}`.trim();

    if (!continued && pending) {
      commands.push({
        command: pending.replace(/\s+/gu, ' '),
        language,
        line: pendingLine,
        section,
      });
      pending = '';
      pendingLine = 0;
    }
  }

  if (pending) {
    commands.push({
      command: pending.replace(/\s+/gu, ' '),
      language,
      line: pendingLine,
      section,
    });
  }

  return commands;
}

export function parseReadme(markdown: string, sourcePath = 'README.md'): ReadmeDocument {
  const tree = unified().use(remarkParse).parse(markdown);
  const slugger = new GithubSlugger();
  const headings: ReadmeDocument['headings'] = [];
  const codeBlocks: CodeBlockClaim[] = [];
  const commands: CommandClaim[] = [];
  const references: ReferenceClaim[] = [];
  const introductionParts: string[] = [];
  let currentSection: SectionKind = 'other';
  let title: string | null = null;
  let introductionOpen = false;

  for (const node of tree.children) {
    if (node.type === 'heading') {
      const text = toString(node).trim();
      headings.push({
        depth: node.depth,
        line: sourceLine(node),
        slug: slugger.slug(text),
        text,
      });
      currentSection = classifySection(text);

      if (node.depth === 1 && title === null) {
        title = text;
        introductionOpen = true;
      } else if (introductionOpen && node.depth <= 2) {
        introductionOpen = false;
      }
    } else if (introductionOpen) {
      const text = toString(node).trim();
      if (text) {
        introductionParts.push(text);
      }
    }

    if (node.type === 'code') {
      const language = (node.lang ?? '').toLowerCase();
      codeBlocks.push({
        language,
        line: sourceLine(node),
        section: currentSection,
        value: node.value,
      });
      commands.push(...extractCommands(node, currentSection));
    }

    collectReferences(node, references);
  }

  return {
    codeBlocks,
    commands,
    headings,
    introduction: introductionParts.join(' ').replace(/\s+/gu, ' ').trim(),
    raw: markdown,
    references,
    sourcePath: sourcePath.replaceAll('\\', '/'),
    title,
  };
}
