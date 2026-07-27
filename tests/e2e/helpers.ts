import { spawn } from 'node:child_process';

export interface ProcessResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

export async function runNode(
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (exitCode) => {
      resolve({ exitCode, stderr, stdout });
    });
  });
}

export function parseActionOutput(raw: string): Record<string, string> {
  const output: Record<string, string> = {};
  const lines = raw.replace(/\r\n/gu, '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const simple = /^([^=]+)=(.*)$/u.exec(line);
    if (simple) {
      output[simple[1] ?? ''] = simple[2] ?? '';
      continue;
    }
    const multiline = /^([^<]+)<<(.+)$/u.exec(line);
    if (!multiline) {
      continue;
    }
    const key = multiline[1] ?? '';
    const delimiter = multiline[2] ?? '';
    const values: string[] = [];
    index += 1;
    while (index < lines.length && lines[index] !== delimiter) {
      values.push(lines[index] ?? '');
      index += 1;
    }
    output[key] = values.join('\n');
  }
  return output;
}
