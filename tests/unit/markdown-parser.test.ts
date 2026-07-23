import { describe, expect, it } from 'vitest';
import { parseReadme } from '../../src/core/markdown.js';

describe('parseReadme', () => {
  it('classifies install, run, test, and example commands with source lines', () => {
    const markdown = `# Airframe

Local-first README proof.

## Installation

\`\`\`sh
$ npm ci --ignore-scripts
\`\`\`

## Quick start

\`\`\`bash
node cli.mjs audit .
\`\`\`

## Tests

\`\`\`shell
npm test
\`\`\`

## Example

\`\`\`console
$ node cli.mjs audit fixtures/healthy
\`\`\`
`;

    const document = parseReadme(markdown, 'README.md');

    expect(document.title).toBe('Airframe');
    expect(document.commands).toEqual([
      expect.objectContaining({
        command: 'npm ci --ignore-scripts',
        line: 8,
        section: 'install',
      }),
      expect.objectContaining({
        command: 'node cli.mjs audit .',
        line: 14,
        section: 'run',
      }),
      expect.objectContaining({ command: 'npm test', line: 20, section: 'test' }),
      expect.objectContaining({
        command: 'node cli.mjs audit fixtures/healthy',
        line: 26,
        section: 'example',
      }),
    ]);
  });

  it('joins continued shell lines, ignores comments, and leaves non-shell blocks alone', () => {
    const markdown = `# Commands

## Installation

\`\`\`sh
# deterministic install
npm ci \\
  --ignore-scripts
\`\`\`

\`\`\`json
{"command": "not executable"}
\`\`\`
`;

    const document = parseReadme(markdown, 'docs/README.md');

    expect(document.commands).toHaveLength(1);
    expect(document.commands[0]).toMatchObject({
      command: 'npm ci --ignore-scripts',
      language: 'sh',
      line: 7,
      section: 'install',
    });
  });

  it('collects links, images, badges, and GitHub-compatible duplicate heading slugs', () => {
    const markdown = `# Project

[Guide](docs/guide.md#usage)
![Screenshot](assets/demo.png)
[![CI](https://img.shields.io/badge/ci-passing-brightgreen)](https://example.test/actions)

## Usage
## Usage
`;

    const document = parseReadme(markdown, 'README.md');

    expect(document.headings.map(({ slug }) => slug)).toEqual(['project', 'usage', 'usage-1']);
    expect(document.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'link', target: 'docs/guide.md#usage' }),
        expect.objectContaining({ kind: 'image', target: 'assets/demo.png' }),
        expect.objectContaining({
          kind: 'badge',
          target: 'https://img.shields.io/badge/ci-passing-brightgreen',
        }),
      ]),
    );
  });
});
