import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface ExternalLinkResult {
  error?: string;
  finalUrl: string;
  method: 'GET' | 'HEAD';
  status: 'blocked' | 'failed' | 'ok';
  statusCode: number | null;
  url: string;
}

export interface HttpLinkCheckerOptions {
  allowPrivateHosts?: boolean;
  fetchImplementation?: typeof fetch;
  maxRedirects?: number;
  timeoutMs?: number;
}

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return true;
  }
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) {
    return isPrivateIpv4(address);
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4(normalized.slice('::ffff:'.length));
  }
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/u.test(normalized)
  );
}

async function assertPublicUrl(url: URL, allowPrivateHosts: boolean): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('URLs containing credentials are blocked.');
  }
  if (allowPrivateHosts) {
    return;
  }
  if (url.hostname.toLowerCase() === 'localhost') {
    throw new Error('Private or loopback host is blocked.');
  }

  const addresses =
    isIP(url.hostname) > 0
      ? [{ address: url.hostname }]
      : await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Private or loopback host is blocked.');
  }
}

export class HttpLinkChecker {
  readonly #allowPrivateHosts: boolean;
  readonly #fetch: typeof fetch;
  readonly #maxRedirects: number;
  readonly #timeoutMs: number;

  constructor(options: HttpLinkCheckerOptions = {}) {
    this.#allowPrivateHosts = options.allowPrivateHosts ?? false;
    this.#fetch = options.fetchImplementation ?? fetch;
    this.#maxRedirects = options.maxRedirects ?? 5;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
  }

  async check(target: string): Promise<ExternalLinkResult> {
    let current: URL;
    try {
      current = new URL(target);
      await assertPublicUrl(current, this.#allowPrivateHosts);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        finalUrl: target,
        method: 'HEAD',
        status: 'blocked',
        statusCode: null,
        url: target,
      };
    }

    let method: 'GET' | 'HEAD' = 'HEAD';
    try {
      for (let redirects = 0; redirects <= this.#maxRedirects; redirects += 1) {
        const response = await this.#fetch(current, {
          ...(method === 'GET' ? { headers: { Range: 'bytes=0-0' } } : {}),
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.#timeoutMs),
        });

        if ((response.status === 405 || response.status === 501) && method === 'HEAD') {
          method = 'GET';
          continue;
        }

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Redirect ${response.status} has no Location header.`);
          }
          if (redirects === this.#maxRedirects) {
            throw new Error(`Redirect limit of ${this.#maxRedirects} exceeded.`);
          }
          current = new URL(location, current);
          await assertPublicUrl(current, this.#allowPrivateHosts);
          method = 'HEAD';
          continue;
        }

        return {
          finalUrl: current.toString(),
          method,
          status: response.ok ? 'ok' : 'failed',
          statusCode: response.status,
          url: target,
        };
      }
      throw new Error('Redirect loop ended unexpectedly.');
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        finalUrl: current.toString(),
        method,
        status: 'failed',
        statusCode: null,
        url: target,
      };
    }
  }
}
