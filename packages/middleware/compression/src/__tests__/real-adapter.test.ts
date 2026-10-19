/**
 * @nextrush/compression - behaviour through real adapters
 *
 * `compression.test.ts` drives the middleware against a mock context. These
 * tests pin what it does against a real Node listener and a real Web request,
 * because compression only has a body to rewrite when the adapter still holds
 * the response after the handler ran.
 *
 * RFC-041 made that true on every adapter: a response method records into the
 * shared outgoing response and the adapter flushes it once the middleware chain
 * unwinds, so a post-handler rewrite reaches the client on both families. The
 * contract below is identical for both, which is the point.
 */
import { createFetchHandler } from '@nextrush/adapter-edge';
import { listen } from '@nextrush/adapter-node';
import { bodyParser } from '@nextrush/body-parser';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { request as httpRequest } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { compression } from '../middleware.js';
import { resetNoOutgoingBodyWarning } from '../warnings.js';

const BIG_ROUTE = '/big';
const SMALL_ROUTE = '/small';
const ECHO_ROUTE = '/echo';
const PAYLOAD_CHARS = 20_000;
const ACCEPT_GZIP = { 'accept-encoding': 'gzip' };
const JSON_HEADERS = { 'content-type': 'application/json' };
const PACKAGE_TAG = '@nextrush/compression';

type TestApp = ReturnType<typeof createApp>;

interface Harness {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  close: () => Promise<void>;
}

function bigPayload(): string {
  return 'x'.repeat(PAYLOAD_CHARS);
}

interface AppOptions {
  /** Response-size floor compression applies, in bytes. */
  threshold?: number;
}

function buildApp({ threshold = 0 }: AppOptions = {}): TestApp {
  const app = createApp();
  const router = createRouter();

  router.get(BIG_ROUTE, (ctx) => ctx.json({ data: bigPayload() }));
  router.get(SMALL_ROUTE, (ctx) => ctx.send('tiny'));
  // The response deliberately differs from the request body, so a test can tell
  // the two apart after decompression.
  router.post(ECHO_ROUTE, (ctx) => ctx.json({ received: ctx.body, marker: 'response-only' }));

  app.use(bodyParser());
  app.use(compression({ threshold }));
  app.route('/', router);

  return app;
}

async function startNode(app: TestApp): Promise<Harness> {
  const server = await listen(app, 0);
  return {
    // A raw request, not `fetch`: undici transparently decodes `content-encoding`
    // while leaving the headers in place, which would hide whether the server
    // encoded the body at all — and would make the length assertion meaningless.
    request: (path, init) =>
      new Promise<Response>((resolve, reject) => {
        const request = httpRequest(
          {
            host: '127.0.0.1',
            port: server.port,
            path,
            method: init?.method ?? 'GET',
            headers: init?.headers as Record<string, string> | undefined,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              const headers = new Headers();
              for (const [name, value] of Object.entries(res.headers)) {
                if (Array.isArray(value)) {
                  for (const item of value) headers.append(name, item);
                } else if (value !== undefined) {
                  headers.set(name, value);
                }
              }
              resolve(
                new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers })
              );
            });
          }
        );
        request.on('error', reject);
        if (typeof init?.body === 'string') request.write(init.body);
        request.end();
      }),
    close: () => server.close(),
  };
}

function startWeb(app: TestApp): Harness {
  const handler = createFetchHandler(app);
  return {
    request: (path, init) => Promise.resolve(handler(new Request(`http://localhost${path}`, init))),
    close: () => Promise.resolve(),
  };
}

const ADAPTERS: ReadonlyArray<{
  name: string;
  start: (app: TestApp) => Harness | Promise<Harness>;
}> = [
  { name: 'node adapter', start: startNode },
  { name: 'web adapter', start: startWeb },
];

/** Decode a gzip response body into its JSON value. */
async function gzipJson(res: Response): Promise<unknown> {
  const bytes = Buffer.from(await res.arrayBuffer());
  return JSON.parse(gunzipSync(bytes).toString('utf8')) as unknown;
}

for (const adapter of ADAPTERS) {
  describe(`compression on the ${adapter.name}`, () => {
    let warnSpy: MockInstance;
    let close: (() => Promise<void>) | undefined;

    beforeEach(() => {
      resetNoOutgoingBodyWarning();
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(async () => {
      await close?.();
      close = undefined;
      warnSpy.mockRestore();
    });

    /** Warnings this package emitted (other packages may warn in the same test). */
    function packageWarnings(): string[] {
      return warnSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.includes(PACKAGE_TAG));
    }

    async function start(options: AppOptions = {}): Promise<Harness> {
      const harness = await adapter.start(buildApp(options));
      close = harness.close;
      return harness;
    }

    it('compresses the response the handler recorded after the chain unwinds', async () => {
      const harness = await start();

      const res = await harness.request(BIG_ROUTE, { headers: ACCEPT_GZIP });

      expect(res.headers.get('content-encoding')).toBe('gzip');
      expect(res.headers.get('vary')).toContain('Accept-Encoding');
      expect(Number(res.headers.get('content-length'))).toBeLessThan(PAYLOAD_CHARS);
      await expect(gzipJson(res)).resolves.toEqual({ data: bigPayload() });
      expect(packageWarnings()).toHaveLength(0);
    });

    it('derives the compressed length from the rewritten body', async () => {
      const harness = await start();

      const res = await harness.request(BIG_ROUTE, { headers: ACCEPT_GZIP });
      const wire = Buffer.from(await res.arrayBuffer());

      expect(Number(res.headers.get('content-length'))).toBe(wire.byteLength);
      // A stale length would truncate or over-read; decompressing proves it agrees.
      expect(JSON.parse(gunzipSync(wire).toString('utf8'))).toEqual({ data: bigPayload() });
    });

    it('never substitutes the parsed request body for the recorded response body', async () => {
      const harness = await start();
      const sent = { data: bigPayload() };

      const res = await harness.request(ECHO_ROUTE, {
        method: 'POST',
        headers: { ...JSON_HEADERS, ...ACCEPT_GZIP },
        body: JSON.stringify(sent),
      });

      expect(res.headers.get('content-encoding')).toBe('gzip');
      await expect(gzipJson(res)).resolves.toEqual({ received: sent, marker: 'response-only' });
    });

    it('leaves a response below the threshold unencoded', async () => {
      const harness = await start({ threshold: 1_000 });

      const res = await harness.request(SMALL_ROUTE, { headers: ACCEPT_GZIP });

      expect(res.headers.get('content-encoding')).toBeNull();
      await expect(res.text()).resolves.toBe('tiny');
      expect(packageWarnings()).toHaveLength(0);
    });

    it('leaves a response unencoded when the client did not ask for an encoding', async () => {
      const harness = await start();

      const res = await harness.request(BIG_ROUTE);

      expect(res.headers.get('content-encoding')).toBeNull();
      await expect(res.json()).resolves.toEqual({ data: bigPayload() });
    });
  });
}
