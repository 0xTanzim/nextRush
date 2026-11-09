/**
 * @nextrush/router — handler return-value settlement contract (RFC-050).
 *
 * A matched handler's resolved value is settled into the response: `Response`
 * adoption, binary/stream forwarding, text, JSON for arrays and objects, JSON
 * `null`, and the string form for other primitives. `undefined` keeps today's
 * empty-response fast path, and middleware returns settle nothing.
 *
 * The context is a recording double of the real one: it mirrors the runtime's
 * content-type rules (`application/json`, `text/plain;charset=UTF-8`,
 * `application/octet-stream`) so the table is asserted as status + type + body.
 * The real runtime wiring is proven end-to-end by the conformance suite and the
 * Next.js real-server integration, not here.
 */

import type { Context, Middleware, Next, RouteHandler } from '@nextrush/types';
import {
  DISPATCH_SETTLED_SYNC,
  RESOLVED_PROMISE,
  type DispatchMarkerCarrier,
} from '@nextrush/types';
import { compose } from '@nextrush/core';
import { describe, expect, it } from 'vitest';
import { compileExecutor } from '../segment-trie';

const JSON_TYPE = 'application/json';
const TEXT_TYPE = 'text/plain;charset=UTF-8';
const BINARY_TYPE = 'application/octet-stream';

interface Call {
  readonly method: 'json' | 'send';
  readonly value: unknown;
}

interface Recorded {
  status: number;
  contentType: string | undefined;
  body: unknown;
  committed: boolean;
  calls: Call[];
  headers: Array<[string, string | number | string[]]>;
}

type RecordingContext = Context & DispatchMarkerCarrier & { recorded: Recorded };

const isNodeReadable = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { pipe?: unknown }).pipe === 'function';

/**
 * Context double recording what the executor asked the real context to send.
 * `responded` flips on the first commit, and an explicit `Content-Type` (from
 * `set`, e.g. Response-header adoption) wins over the body method's default.
 */
function createCtx(overrides: Partial<Context> = {}): RecordingContext {
  const recorded: Recorded = {
    status: 200,
    contentType: undefined,
    body: undefined,
    committed: false,
    calls: [],
    headers: [],
  };

  const ctx = {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    headers: {},
    state: {},
    raw: { req: {}, res: {} },
    get status(): number {
      return recorded.status;
    },
    set status(status: number) {
      recorded.status = status;
    },
    get responded(): boolean {
      return recorded.committed;
    },
    json(data: unknown): void {
      recorded.calls.push({ method: 'json', value: data });
      recorded.body = JSON.stringify(data);
      recorded.contentType = JSON_TYPE;
      recorded.committed = true;
    },
    send(data: unknown): void {
      recorded.calls.push({ method: 'send', value: data });
      recorded.body = data;
      if (recorded.contentType === undefined) {
        if (typeof data === 'string') recorded.contentType = TEXT_TYPE;
        else if (
          data instanceof Uint8Array ||
          data instanceof ArrayBuffer ||
          data instanceof ReadableStream ||
          isNodeReadable(data)
        ) {
          recorded.contentType = BINARY_TYPE;
        }
      }
      recorded.committed = true;
    },
    html(): void {},
    redirect(): void {},
    get(): undefined {
      return undefined;
    },
    set(field: string, value: string | number | string[]): void {
      const name = field.toLowerCase();
      recorded.headers.push([name, value]);
      if (name === 'content-type') {
        recorded.contentType = Array.isArray(value) ? value.join(', ') : String(value);
      }
    },
    setNext(): void {},
    next(): Promise<void> {
      return Promise.resolve();
    },
    ...overrides,
  } as unknown as RecordingContext;

  ctx.recorded = recorded;
  return ctx;
}

/** A handler that returns a value, which the public `RouteHandler` type disallows. */
const returning = (fn: (ctx: Context, next: Next) => unknown): RouteHandler =>
  fn as unknown as RouteHandler;

const run = (executor: (ctx: Context) => Promise<void>, ctx: Context): Promise<void> =>
  executor(ctx);

describe('return settlement — value table', () => {
  it('settles an array as JSON', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    const ctx = createCtx();

    await run(compileExecutor(returning(() => rows), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: rows }]);
    expect(ctx.recorded.status).toBe(200);
    expect(ctx.recorded.contentType).toBe(JSON_TYPE);
    expect(ctx.recorded.body).toBe('[{"id":1},{"id":2}]');
  });

  it('settles a plain object as JSON', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => ({ ok: true })), []), ctx);

    expect(ctx.recorded.contentType).toBe(JSON_TYPE);
    expect(ctx.recorded.body).toBe('{"ok":true}');
  });

  it('settles a string as a text body', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => 'hello'), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: 'hello' }]);
    expect(ctx.recorded.contentType).toBe(TEXT_TYPE);
    expect(ctx.recorded.body).toBe('hello');
  });

  it('forwards a Uint8Array unchanged', async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const ctx = createCtx();

    await run(compileExecutor(returning(() => bytes), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: bytes }]);
    expect(ctx.recorded.contentType).toBe(BINARY_TYPE);
  });

  it('forwards an ArrayBuffer unchanged', async () => {
    const buffer = new Uint8Array([9, 8, 7]).buffer;
    const ctx = createCtx();

    await run(compileExecutor(returning(() => buffer), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: buffer }]);
    expect(ctx.recorded.contentType).toBe(BINARY_TYPE);
  });

  it('forwards a Web ReadableStream unchanged', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    });
    const ctx = createCtx();

    await run(compileExecutor(returning(() => stream), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: stream }]);
    expect(ctx.recorded.contentType).toBe(BINARY_TYPE);
  });

  it('forwards a Node readable stream unchanged', async () => {
    const readable = {
      pipe: () => undefined,
      async *[Symbol.asyncIterator]() {
        // no chunks
      },
    };
    const ctx = createCtx();

    await run(compileExecutor(returning(() => readable), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: readable }]);
    expect(ctx.recorded.contentType).toBe(BINARY_TYPE);
  });

  it('adopts a returned Response status, headers, cookies and body', async () => {
    const rows = [{ id: 1 }];
    const response = new Response(JSON.stringify(rows), {
      status: 201,
      headers: [
        ['content-type', JSON_TYPE],
        ['x-rows', '1'],
        ['set-cookie', 'a=1; Path=/'],
        ['set-cookie', 'b=2; Path=/'],
      ],
    });
    const ctx = createCtx();

    await run(compileExecutor(returning(() => response), []), ctx);

    expect(ctx.recorded.status).toBe(201);
    expect(ctx.recorded.contentType).toBe(JSON_TYPE);
    expect(ctx.recorded.headers).toContainEqual(['x-rows', '1']);
    expect(ctx.recorded.headers).toContainEqual(['set-cookie', ['a=1; Path=/', 'b=2; Path=/']]);
    const sent = ctx.recorded.body;
    expect(sent).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(sent as Uint8Array)).toBe('[{"id":1}]');
  });

  it('adopts a bodyless Response as status and headers only', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => new Response(null, { status: 204 })), []), ctx);

    expect(ctx.recorded.status).toBe(204);
    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: null }]);
  });

  it('settles null as JSON null', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => null), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: null }]);
    expect(ctx.recorded.contentType).toBe(JSON_TYPE);
    expect(ctx.recorded.body).toBe('null');
  });

  it('settles a number as its string form', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => 42), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: '42' }]);
    expect(ctx.recorded.contentType).toBe(TEXT_TYPE);
  });

  it('settles a boolean as its string form', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => true), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: 'true' }]);
    expect(ctx.recorded.contentType).toBe(TEXT_TYPE);
  });

  it('settles a symbol as its string form', async () => {
    const ctx = createCtx();

    await run(compileExecutor(returning(() => Symbol('tag')), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'send', value: 'Symbol(tag)' }]);
    expect(ctx.recorded.contentType).toBe(TEXT_TYPE);
  });

  it('routes a returned function to JSON instead of echoing its source', async () => {
    const ctx = createCtx();
    const fn = () => 'handler-source-text';

    await run(compileExecutor(returning(() => fn), []), ctx);

    // Delegated to the JSON path, whose serializer turns a function into an
    // actionable error; `String(fn)` would have sent the source to the client.
    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: fn }]);
  });

  it('settles identically when route middleware is present', async () => {
    const rows = [{ id: 1 }];
    const ctx = createCtx();
    const passthrough = ((_ctx: Context, next: Next) => next()) as Middleware;

    await run(compileExecutor(returning(() => rows), [passthrough]), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: rows }]);
    expect(ctx.recorded.body).toBe('[{"id":1}]');
  });
});

describe('return settlement — precedence and boundaries', () => {
  it('keeps a committed response and ignores the returned value', async () => {
    const ctx = createCtx();
    const handler = returning((c) => {
      c.json({ ok: true });
      return ['ignored'];
    });

    await run(compileExecutor(handler, []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: { ok: true } }]);
    expect(ctx.recorded.body).toBe('{"ok":true}');
  });

  it('settles the handler value and not an application-level middleware return', async () => {
    const handlerRows = ['from handler'];
    const ctx = createCtx();
    const appMiddleware = ((_ctx: Context, next: Next) =>
      next().then(() => ['from middleware'])) as unknown as Middleware;
    const composed = compose([appMiddleware, compileExecutor(returning(() => handlerRows), [])]);

    await composed(ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: handlerRows }]);
  });

  it('settles the handler value and not a route-level middleware return', async () => {
    const handlerRows = ['from handler'];
    const ctx = createCtx();
    const routeMiddleware = ((_ctx: Context, next: Next) =>
      next().then(() => ['from middleware'])) as unknown as Middleware;
    const executor = compileExecutor(returning(() => handlerRows), [routeMiddleware]);

    await run(executor, ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: handlerRows }]);
  });

  it('awaits and settles a promise resolving to an array', async () => {
    const rows = [{ id: 1 }];
    const ctx = createCtx();

    await run(compileExecutor(returning(async () => rows), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: rows }]);
  });

  it('awaits and settles a non-Promise thenable resolving to an array', async () => {
    const rows = [{ id: 1 }];
    const thenable = {
      then(resolve: (value: unknown) => void): void {
        resolve(rows);
      },
    };
    const ctx = createCtx();

    await run(compileExecutor(returning(() => thenable), []), ctx);

    expect(ctx.recorded.calls).toEqual([{ method: 'json', value: rows }]);
  });
});

describe('return settlement — unchanged and failure paths', () => {
  it('leaves a void handler producing no body and sets the sync marker', async () => {
    const ctx = createCtx();
    const executor = compileExecutor((c) => {
      c.status = 200;
    }, []);

    const result = executor(ctx);

    expect(result).toBe(RESOLVED_PROMISE);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
    expect(ctx.recorded.calls).toEqual([]);
  });

  it('settles a synchronous returned value within the same tick', () => {
    const rows = [{ id: 1 }];
    const ctx = createCtx();
    const executor = compileExecutor(returning(() => rows), []);

    const result = executor(ctx);

    expect(ctx.recorded.body).toBe('[{"id":1}]');
    expect(result).toBe(RESOLVED_PROMISE);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBe(true);
  });

  it('rejects when the returned value has no JSON representation', async () => {
    const ctx = createCtx();
    const executor = compileExecutor(returning(() => ({ id: 1n })), []);

    await expect(executor(ctx)).rejects.toThrow(/BigInt|bigint/);
    expect(ctx[DISPATCH_SETTLED_SYNC]).toBeUndefined();
  });

  it('rejects when a returned Response body cannot be read', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('body read failed'));
      },
    });
    const ctx = createCtx();
    const executor = compileExecutor(returning(() => new Response(body)), []);

    await expect(executor(ctx)).rejects.toThrow('body read failed');
  });
});
