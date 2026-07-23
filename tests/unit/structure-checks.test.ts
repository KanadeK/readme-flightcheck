import { describe, expect, it } from 'vitest';
import { checkStructure } from '../../src/core/checks.js';
import { parseReadme } from '../../src/core/markdown.js';

describe('checkStructure', () => {
  it('accepts a README with evidence for every MVP claim category', () => {
    const document = parseReadme(
      `# Flight-ready

Local-first verification with a clear privacy and security boundary. Status: v0.1.0.

![Report](assets/report.png)
[![CI](https://img.shields.io/badge/ci-passing-brightgreen)](https://example.test/actions)

## Installation
\`\`\`sh
npm ci --ignore-scripts
\`\`\`

## Usage
\`\`\`sh
node cli.mjs audit .
\`\`\`

## Tests
\`\`\`sh
npm test
\`\`\`

## Example
\`\`\`sh
node cli.mjs audit fixtures/healthy
\`\`\`
`,
      'README.md',
    );

    expect(checkStructure(document)).toEqual([]);
  });

  it('explains every deduction for a hollow README', () => {
    const document = parseReadme('# Name\n', 'README.md');
    const findings = checkStructure(document);

    expect(findings.map(({ code }) => code)).toEqual([
      'introduction.missing',
      'command.install.missing',
      'command.run.missing',
      'command.test.missing',
      'command.example.missing',
      'screenshot.missing',
      'badge.missing',
      'status.missing',
      'security-boundary.missing',
    ]);
    expect(findings.reduce((total, finding) => total + finding.deduction, 0)).toBe(68);
  });
});
