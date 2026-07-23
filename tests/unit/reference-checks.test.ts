import { describe, expect, it } from 'vitest';
import { checkReferences } from '../../src/core/checks.js';
import { parseReadme } from '../../src/core/markdown.js';
import type { RepositorySnapshot } from '../../src/core/types.js';

const snapshot: RepositorySnapshot = {
  entries: {
    'README.md': { kind: 'file', size: 200 },
    'assets/demo.png': { kind: 'file', size: 128 },
    docs: { kind: 'directory', size: 0 },
    'docs/guide.md': {
      content: '# Guide\n\n## Usage\n',
      kind: 'file',
      size: 18,
    },
  },
};

describe('checkReferences', () => {
  it('accepts existing files, non-empty images, directories, and target anchors', () => {
    const document = parseReadme(
      `# Project

[Guide](docs/guide.md#usage)
[Docs](docs/)
![Demo](assets/demo.png)
[Remote](https://example.test)
`,
      'README.md',
    );

    expect(checkReferences(document, snapshot)).toEqual([]);
  });

  it('returns distinct evidence for missing files, anchors, empty images, and root escape', () => {
    const document = parseReadme(
      `# Project

[Missing](docs/missing.md)
[Bad anchor](docs/guide.md#absent)
![Empty](assets/empty.png)
[Escape](../private.txt)
`,
      'README.md',
    );
    const withEmptyImage: RepositorySnapshot = {
      entries: {
        ...snapshot.entries,
        'assets/empty.png': { kind: 'file', size: 0 },
      },
    };

    const findings = checkReferences(document, withEmptyImage);

    expect(findings.map(({ code }) => code)).toEqual([
      'reference.missing',
      'anchor.missing',
      'image.empty',
      'reference.outside-root',
    ]);
    expect(findings.every(({ deduction }) => deduction > 0)).toBe(true);
    expect(findings[0]).toMatchObject({
      file: 'README.md',
      line: 3,
      target: 'docs/missing.md',
    });
  });

  it('reports malformed percent-encoding instead of throwing', () => {
    const document = parseReadme('[Bad](docs/%E0%A4%A.md)', 'README.md');

    expect(checkReferences(document, snapshot)).toEqual([
      expect.objectContaining({ code: 'reference.invalid', severity: 'error' }),
    ]);
  });
});
