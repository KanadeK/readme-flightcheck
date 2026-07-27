import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { auditRepositoryBase } from '../../src/application/audit-base.js';

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }),
    ),
  );
});

async function createRepository(
  readme: string,
  files: Record<string, string> = {},
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'flightcheck-audit-base-'));
  temporaryDirectories.push(directory);
  await writeFile(path.join(directory, 'README.md'), readme, 'utf8');
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const target = path.join(directory, relativePath);
      await writeFile(target, content, 'utf8');
    }),
  );
  return directory;
}

async function startFixtureServer(): Promise<string> {
  const server = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe('auditRepositoryBase failure paths', () => {
  it('turns rejected and timed-out real commands into transparent findings', async () => {
    const root = await createRepository(
      `# Isolated command fixture

## Install

\`\`\`sh
curl https://example.test/install
\`\`\`

## Run

\`\`\`sh
node slow.mjs
\`\`\`
`,
      { 'slow.mjs': 'setTimeout(() => {}, 1000);\n' },
    );

    const result = await auditRepositoryBase({
      commandTimeoutMs: 50,
      execute: true,
      generatedAt: new Date('2026-07-27T00:00:00.000Z'),
      root,
    });

    expect(result.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'command.rejected', category: 'security', deduction: 18 }),
        expect.objectContaining({
          code: 'command.timed-out',
          category: 'execution',
          deduction: 20,
        }),
      ]),
    );
    expect(result.report.commandResults.map(({ status }) => status)).toEqual([
      'rejected',
      'timed-out',
    ]);
  });

  it('records external and snapshot failures without hiding their evidence', async () => {
    const baseUrl = await startFixtureServer();
    const root = await createRepository(
      `# Network proof

## Install

\`\`\`sh
node ready.mjs
\`\`\`

[missing endpoint](${baseUrl}/missing)
`,
      { 'ready.mjs': 'console.log("ready");\n' },
    );
    const snapshot = {
      baselinePath: 'baseline.png',
      diffPixels: 12,
      diffRatio: 1,
      dimensionsMatch: false,
      matches: false,
      outputPath: 'latest.png',
      url: 'file:///fixture.html',
    };

    const failedExternal = await auditRepositoryBase(
      {
        allowPrivateHosts: true,
        checkExternal: true,
        generatedAt: new Date('2026-07-27T00:00:00.000Z'),
        root,
      },
      snapshot,
    );
    const blockedExternal = await auditRepositoryBase({
      checkExternal: true,
      generatedAt: new Date('2026-07-27T00:00:00.000Z'),
      root,
    });

    expect(failedExternal.externalResults).toEqual([
      expect.objectContaining({ status: 'failed', statusCode: 404 }),
    ]);
    expect(failedExternal.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'external-link.failed', category: 'network' }),
        expect.objectContaining({ code: 'snapshot.dimensions-changed', deduction: 20 }),
      ]),
    );
    expect(failedExternal.report.evidence).toMatchObject({
      externalLinksChecked: 1,
      snapshotsCompared: 1,
    });
    expect(blockedExternal.externalResults).toEqual([
      expect.objectContaining({ status: 'blocked' }),
    ]);
    expect(blockedExternal.report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'external-link.blocked', category: 'security' }),
      ]),
    );
  });
});
