import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpLinkChecker } from '../../src/adapters/http.js';

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  server = createServer((request, response) => {
    switch (request.url) {
      case '/ok':
        response.writeHead(204).end();
        break;
      case '/fallback':
        if (request.method === 'HEAD') {
          response.writeHead(405).end();
        } else {
          response.writeHead(206, { 'content-range': 'bytes 0-0/1' }).end('x');
        }
        break;
      case '/redirect':
        response.writeHead(302, { location: '/ok' }).end();
        break;
      case '/redirect-without-location':
        response.writeHead(302).end();
        break;
      case '/loop':
        response.writeHead(302, { location: '/loop' }).end();
        break;
      default:
        response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
});

describe('HttpLinkChecker', () => {
  it('checks a real endpoint, follows redirects, and falls back from HEAD to GET', async () => {
    const checker = new HttpLinkChecker({ allowPrivateHosts: true, timeoutMs: 2000 });

    await expect(checker.check(`${baseUrl}/ok`)).resolves.toMatchObject({
      method: 'HEAD',
      status: 'ok',
      statusCode: 204,
    });
    await expect(checker.check(`${baseUrl}/redirect`)).resolves.toMatchObject({
      finalUrl: `${baseUrl}/ok`,
      method: 'HEAD',
      status: 'ok',
    });
    await expect(checker.check(`${baseUrl}/fallback`)).resolves.toMatchObject({
      method: 'GET',
      status: 'ok',
      statusCode: 206,
    });
  });

  it('reports HTTP failures and malformed redirect chains without throwing', async () => {
    const checker = new HttpLinkChecker({
      allowPrivateHosts: true,
      maxRedirects: 1,
      timeoutMs: 2000,
    });

    await expect(checker.check(`${baseUrl}/missing`)).resolves.toMatchObject({
      status: 'failed',
      statusCode: 404,
    });
    await expect(checker.check(`${baseUrl}/redirect-without-location`)).resolves.toMatchObject({
      error: 'Redirect 302 has no Location header.',
      status: 'failed',
    });
    await expect(checker.check(`${baseUrl}/loop`)).resolves.toMatchObject({
      error: 'Redirect limit of 1 exceeded.',
      status: 'failed',
    });
  });

  it('blocks unsafe destinations and contains transport errors', async () => {
    const blockedChecker = new HttpLinkChecker();
    await expect(blockedChecker.check(`${baseUrl}/ok`)).resolves.toMatchObject({
      error: 'Private or loopback host is blocked.',
      status: 'blocked',
    });
    await expect(blockedChecker.check('file:///etc/passwd')).resolves.toMatchObject({
      error: 'Unsupported URL protocol: file:',
      status: 'blocked',
    });
    await expect(blockedChecker.check('https://user:secret@example.test')).resolves.toMatchObject({
      error: 'URLs containing credentials are blocked.',
      status: 'blocked',
    });

    const failingFetch = (() => Promise.reject(new Error('deterministic offline'))) as typeof fetch;
    const failingChecker = new HttpLinkChecker({
      allowPrivateHosts: true,
      fetchImplementation: failingFetch,
    });
    await expect(failingChecker.check(`${baseUrl}/ok`)).resolves.toMatchObject({
      error: 'deterministic offline',
      status: 'failed',
    });
  });
});
