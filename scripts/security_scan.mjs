import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const trackedFiles = execFileSync('git', ['ls-files', '-z'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
const patterns = [
  { label: 'AWS access key', expression: /AKIA[0-9A-Z]{16}/u },
  { label: 'GitHub personal token', expression: /gh[pousr]_[A-Za-z0-9]{30,}/u },
  { label: 'private key block', expression: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { label: 'Slack token', expression: /xox[baprs]-[A-Za-z0-9-]{20,}/u },
];
const findings = [];

for (const relativePath of trackedFiles) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  let content;
  try {
    content = await readFile(absolutePath, 'utf8');
  } catch {
    continue;
  }
  for (const { expression, label } of patterns) {
    const match = expression.exec(content);
    if (match) {
      findings.push(`${relativePath}: ${label}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Potential secrets found:\n${findings.join('\n')}`);
}

process.stdout.write(`Secret scan passed for ${trackedFiles.length} tracked file(s).\n`);
